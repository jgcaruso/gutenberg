/**
 * External dependencies
 */
const { isEqual } = require( 'lodash' );

/**
 * WordPress dependencies
 */
import {
	__experimentalBlock as Block,
	BlockIcon,
	InspectorControls,
} from '@wordpress/block-editor';
import { PanelBody, Placeholder, ToggleControl } from '@wordpress/components';
import { useSelect } from '@wordpress/data';
import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import TableOfContentsList from './list';
import { getHeadingsFromContent, linearToNestedHeadingList } from './utils';

/** @typedef {import('@wordpress/element').WPComponent} WPComponent */

/**
 * @typedef WPTableOfContentsEditProps
 *
 * @param {string|undefined} className
 */

/**
 * Table of Contents block edit component.
 *
 * @param {WPTableOfContentsEditProps} props The props.
 *
 * @return {WPComponent} The component.
 */
export default function TableOfContentsEdit( {
	attributes,
	className,
	clientId,
	setAttributes,
} ) {
	const { showOnlyCurrentPageHeadings } = attributes;

	// Local state; not saved to block attributes. The saved block is dynamic and uses PHP to generate its content.
	const [ headings, setHeadings ] = useState( [] );

	const postContent = useSelect( ( select ) => {
		return select( 'core/editor' ).getEditedPostContent();
	}, [] );

	const pageIndex = useSelect(
		( select ) => {
			const { getBlockIndex, getBlockName, getBlockOrder } = select(
				'core/block-editor'
			);

			const blockIndex = getBlockIndex( clientId );
			const blockOrder = getBlockOrder();

			// Calculate which page the block will appear in on the front-end by
			// counting how many core/nextpage blocks precede it.
			// Unfortunately, this does not account for <!--nextpage--> tags in
			// other blocks, so in certain edge cases, this will calculate the
			// wrong page number. Thankfully, this issue only affects the editor
			// implementation.
			let page = 1;
			for ( let i = 0; i < blockIndex; i++ ) {
				if ( getBlockName( blockOrder[ i ] ) === 'core/nextpage' ) {
					page++;
				}
			}

			return page;
		},
		[ clientId ]
	);

	useEffect( () => {
		let latestHeadings;

		if ( showOnlyCurrentPageHeadings ) {
			const pagesOfContent = postContent.split( '<!--nextpage-->' );

			latestHeadings = getHeadingsFromContent(
				pagesOfContent[ pageIndex - 1 ]
			);
		} else {
			latestHeadings = getHeadingsFromContent( postContent );
		}

		if ( ! isEqual( headings, latestHeadings ) ) {
			setHeadings( latestHeadings );
		}
	}, [ pageIndex, postContent, showOnlyCurrentPageHeadings ] );

	const inspectorControls = (
		<InspectorControls>
			<PanelBody title={ __( 'Table of Contents settings' ) }>
				<ToggleControl
					label={ __( 'Only show headings from current page.' ) }
					checked={ showOnlyCurrentPageHeadings }
					onChange={ ( value ) =>
						setAttributes( { showOnlyCurrentPageHeadings: value } )
					}
					help={
						showOnlyCurrentPageHeadings
							? __(
									'Only showing headings from the current page if the post is paginated.'
							  )
							: __(
									'Toggle to only show headings from the current page if the post is paginated.'
							  )
					}
				/>
			</PanelBody>
		</InspectorControls>
	);

	// If there are no headings or the only heading is empty.
	if ( headings.length === 0 || headings[ 0 ].content === '' ) {
		return (
			<Block.div>
				{ inspectorControls }
				<Placeholder
					className="wp-block-table-of-contents"
					icon={ <BlockIcon icon="list-view" /> }
					label="Table of Contents"
					instructions={ __(
						'Start adding Heading blocks to create a table of contents. Headings with HTML anchors will be linked here.'
					) }
				/>
			</Block.div>
		);
	}

	return (
		<Block.nav className={ className }>
			{ inspectorControls }
			<TableOfContentsList
				nestedHeadingList={ linearToNestedHeadingList( headings ) }
			/>
		</Block.nav>
	);
}
