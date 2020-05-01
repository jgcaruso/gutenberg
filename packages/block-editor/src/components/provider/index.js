/**
 * External dependencies
 */
import { last, noop } from 'lodash';

/**
 * WordPress dependencies
 */
import isShallowEqual from '@wordpress/is-shallow-equal';
import { Component } from '@wordpress/element';
import { withDispatch } from '@wordpress/data';
import { compose } from '@wordpress/compose';

/**
 * Internal dependencies
 */
import withRegistryProvider from './with-registry-provider';

/** @typedef {import('@wordpress/data').WPDataRegistry} WPDataRegistry */

class BlockEditorProvider extends Component {
	componentDidMount() {
		this.props.updateSettings( this.props.settings );
		this.props.resetBlocks( this.props.value );
		this.attachChangeObserver( this.props.registry );
		this.isSyncingOutcomingValue = [];
	}

	componentDidUpdate( prevProps ) {
		const {
			settings,
			updateSettings,
			value,
			resetBlocks,
			selectionStart,
			selectionEnd,
			resetSelection,
			registry,
		} = this.props;

		if ( settings !== prevProps.settings ) {
			updateSettings( settings );
		}

		if ( registry !== prevProps.registry ) {
			this.attachChangeObserver( registry );
		}

		if ( this.isSyncingOutcomingValue.includes( value ) ) {
			// Skip block reset if the value matches expected outbound sync
			// triggered by this component by a preceding change detection.
			// Only skip if the value matches expectation, since a reset should
			// still occur if the value is modified (not equal by reference),
			// to allow that the consumer may apply modifications to reflect
			// back on the editor.
			if ( last( this.isSyncingOutcomingValue ) === value ) {
				this.isSyncingOutcomingValue = [];
			}
		} else if ( value !== prevProps.value ) {
			// Reset changing value in all other cases than the sync described
			// above. Since this can be reached in an update following an out-
			// bound sync, unset the outbound value to avoid considering it in
			// subsequent renders.
			this.isSyncingOutcomingValue = [];
			this.isSyncingIncomingValue = value;
			resetBlocks( value );

			if ( selectionStart && selectionEnd ) {
				resetSelection( selectionStart, selectionEnd );
			}
		}
	}

	componentWillUnmount() {
		if ( this.unsubscribe ) {
			this.unsubscribe();
		}
	}

	/**
	 * Given a registry object, overrides the default dispatch behavior for the
	 * `core/block-editor` store to interpret a state change and decide whether
	 * we should call `onChange` or `onInput` depending on whether the change
	 * is persistent or not.
	 *
	 * This needs to be done synchronously after state changes (instead of using
	 * `componentDidUpdate`) in order to avoid batching these changes.
	 *
	 * @param {WPDataRegistry} registry Registry from which block editor
	 *                                  dispatch is to be overridden.
	 */
	attachChangeObserver( registry ) {
		if ( this.unsubscribe ) {
			this.unsubscribe();
		}

		const {
			getBlocks,
			getSelectionStart,
			getSelectionEnd,
			areAnyInnerBlocksControlled,
			isLastBlockChangePersistent,
			__unstableIsLastBlockChangeIgnored,
		} = registry.select( 'core/block-editor' );

		let blocks = getBlocks();
		let isPersistent = isLastBlockChangePersistent();
		let previousAreBlocksDifferent = false;

		this.unsubscribe = registry.subscribe( () => {
			const { onChange = noop, onInput = noop } = this.props;

			const newBlocks = getBlocks();
			const newIsPersistent = isLastBlockChangePersistent();

			// Avoid the more expensive equality check if there are no controlled
			// inner block areas.
			const areBlocksDifferent = areAnyInnerBlocksControlled()
				? ! isShallowEqual( newBlocks, blocks )
				: newBlocks !== blocks;

			if (
				areBlocksDifferent &&
				( this.isSyncingIncomingValue ||
					__unstableIsLastBlockChangeIgnored() )
			) {
				this.isSyncingIncomingValue = null;
				blocks = newBlocks;
				isPersistent = newIsPersistent;
				return;
			}

			// Since we often dispatch an action to mark the previous action as
			// persistent, we need to make sure that the blocks changed on the
			// previous action before committing the change.
			const didPersistenceChange =
				previousAreBlocksDifferent &&
				! areBlocksDifferent &&
				newIsPersistent &&
				! isPersistent;

			if ( areBlocksDifferent || didPersistenceChange ) {
				// When knowing the blocks value is changing, assign instance
				// value to skip reset in subsequent `componentDidUpdate`.
				if ( areBlocksDifferent ) {
					this.isSyncingOutcomingValue.push( newBlocks );
				}

				blocks = newBlocks;
				isPersistent = newIsPersistent;

				const selectionStart = getSelectionStart();
				const selectionEnd = getSelectionEnd();

				if ( isPersistent ) {
					onChange( blocks, { selectionStart, selectionEnd } );
				} else {
					onInput( blocks, { selectionStart, selectionEnd } );
				}
			}
			previousAreBlocksDifferent = areBlocksDifferent;
		} );
	}

	render() {
		const { children } = this.props;

		return children;
	}
}

export default compose( [
	withRegistryProvider,
	withDispatch( ( dispatch ) => {
		const { updateSettings, resetBlocks, resetSelection } = dispatch(
			'core/block-editor'
		);

		return {
			updateSettings,
			resetBlocks,
			resetSelection,
		};
	} ),
] )( BlockEditorProvider );
