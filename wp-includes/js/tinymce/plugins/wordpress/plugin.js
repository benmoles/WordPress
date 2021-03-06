/* global tinymce, autosave, getUserSetting, setUserSetting, switchEditors */
tinymce.PluginManager.add( 'wordpress', function( editor ) {
	var DOM = tinymce.DOM, wpAdvButton, modKey, style,
		last = 0;

	function toggleToolbars( state ) {
		var iframe, initial, toolbars,
			pixels = 0;

		initial = ( state === 'hide' );

		if ( editor.theme.panel ) {
			toolbars = editor.theme.panel.find('.toolbar');
		}

		if ( ! toolbars || toolbars.length < 2 || ( state === 'hide' && ! toolbars[1].visible() ) ) {
			return;
		}

		if ( ! state && toolbars[1].visible() ) {
			state = 'hide';
		}

		tinymce.each( toolbars, function( toolbar, i ) {
			if ( i > 0 ) {
				if ( state === 'hide' ) {
					toolbar.hide();
					pixels += 30;
				} else {
					toolbar.show();
					pixels -= 30;
				}
			}
		});

		if ( pixels && ! initial ) {
			iframe = editor.getContentAreaContainer().firstChild;
			DOM.setStyle( iframe, 'height', iframe.clientHeight + pixels ); // Resize iframe

			if ( state === 'hide' ) {
				setUserSetting('hidetb', '1');
				wpAdvButton && wpAdvButton.active( false );
			} else {
				setUserSetting('hidetb', '0');
				wpAdvButton && wpAdvButton.active( true );
			}
		}
	}

	// Add the kitchen sink button :)
	editor.addButton( 'wp_adv', {
		tooltip: 'Toolbar Toggle',
		cmd: 'WP_Adv',
		onPostRender: function() {
			wpAdvButton = this;
		}
	});

	// Hide the toolbars after loading
	editor.on( 'PostRender', function() {
		if ( getUserSetting('hidetb', '1') === '1' ) {
			toggleToolbars( 'hide' );
		}
	});

	editor.addCommand( 'WP_Adv', function() {
		toggleToolbars();
	});

	editor.on( 'focus', function() {
        window.wpActiveEditor = editor.id;
    });

	// Replace Read More/Next Page tags with images
	editor.on( 'BeforeSetContent', function( e ) {
		if ( e.content ) {
			if ( e.content.indexOf( '<!--more' ) !== -1 ) {
				e.content = e.content.replace( /<!--more(.*?)-->/g, function( match, moretext ) {
					return '<img src="' + tinymce.Env.transparentSrc + '" data-wp-more="' + moretext + '" ' +
						'class="wp-more-tag mce-wp-more" title="Read More..." data-mce-resize="false" data-mce-placeholder="1" />';
				});
			}

			if ( e.content.indexOf( '<!--nextpage-->' ) !== -1 ) {
				e.content = e.content.replace( /<!--nextpage-->/g,
					'<img src="' + tinymce.Env.transparentSrc + '" class="wp-more-tag mce-wp-nextpage" ' +
						'title="Page break" data-mce-resize="false" data-mce-placeholder="1" />' );
			}
		}
	});

	// Replace images with tags
	editor.on( 'PostProcess', function( e ) {
		if ( e.get ) {
			e.content = e.content.replace(/<img[^>]+>/g, function( image ) {
				var match, moretext = '';

				if ( image.indexOf('wp-more-tag') !== -1 ) {
					if ( image.indexOf('mce-wp-more') !== -1 ) {
						if ( match = image.match( /data-wp-more="([^"]+)"/ ) ) {
							moretext = match[1];
						}

						image = '<!--more' + moretext + '-->';
					} else if ( image.indexOf('mce-wp-nextpage') !== -1 ) {
						image = '<!--nextpage-->';
					}
				}

				return image;
			});
		}
	});

	// Display the tag name instead of img in element path
	editor.on( 'ResolveName', function( e ) {
		var dom = editor.dom,
			target = e.target;

		if ( target.nodeName === 'IMG' && dom.hasClass( target, 'wp-more-tag' ) ) {
			if ( dom.hasClass( target, 'mce-wp-more' ) ) {
				e.name = 'more';
			} else if ( dom.hasClass( target, 'mce-wp-nextpage' ) ) {
				e.name = 'nextpage';
			}
		}
	});

	// Make sure the "more" tag is in a separate paragraph
	editor.on( 'PreProcess', function( event ) { 
		var more; 

		if ( event.save ) { 
			more = editor.dom.select( 'img.wp-more-tag', event.node ); 

			if ( more.length ) { 
				tinymce.each( more, function( node ) { 
					var parent = node.parentNode, p; 

					if ( parent.nodeName === 'P' && parent.childNodes.length > 1 ) { 
						p = editor.dom.create('p'); 
						parent.parentNode.insertBefore( p, parent ); 
						p.appendChild( node ); 
					} 
				}); 
			} 
		} 
	}); 

	// Register commands
	editor.addCommand( 'WP_More', function( tag ) {
		var parent, html, title, p1, p2,
			classname = 'wp-more-tag',
			spacer = tinymce.Env.ie ? '' : '<br data-mce-bogus="1" />',
			dom = editor.dom,
			node = editor.selection.getNode();

		tag = tag || 'more';
		classname += ' mce-wp-' + tag;
		title = tag === 'more' ? 'More...' : 'Next Page';
		html = '<img src="' + tinymce.Env.transparentSrc + '" title="' + title + '" class="' + classname + '" ' +
			'data-mce-resize="false" data-mce-placeholder="1" />';

		if ( node.nodeName === 'BODY' ) {
			editor.insertContent( '<p>' + html + '</p><p></p>' );
			return;
		}

		// Get the top level parent node
		parent = dom.getParent( node, function( found ) {
			if ( found.parentNode && found.parentNode.nodeName === 'BODY' ) {
				return true;
			}

			return false;
		}, editor.getBody() );

		if ( parent ) {
			p1 = dom.create( 'p', null, html );
			dom.insertAfter( p1, parent );

			if ( ! ( p2 = p1.nextSibling ) ) {
				p2 = dom.create( 'p', null, spacer );
				dom.insertAfter( p2, p1 );
			}

			editor.nodeChanged();
			editor.selection.setCursorLocation( p2, 0 );
		}
	});

	editor.addCommand( 'WP_Page', function() {
		editor.execCommand( 'WP_More', 'nextpage' );
	});

	editor.addCommand( 'WP_Help', function() {
		editor.windowManager.open({
			url: tinymce.baseURL + '/wp-mce-help.php',
			width: 450,
			height: 420,
			inline: 1
		});
	});

	editor.addCommand( 'WP_Medialib', function() {
		if ( typeof wp !== 'undefined' && wp.media && wp.media.editor ) {
			wp.media.editor.open( editor.id );
		}
	});

	// Register buttons
	editor.addButton( 'wp_more', {
		tooltip: 'Insert Read More tag',
		onclick: function() {
			editor.execCommand( 'WP_More', 'more' );
		}
	});

	editor.addButton( 'wp_page', {
		tooltip: 'Page break',
		onclick: function() {
			editor.execCommand( 'WP_More', 'nextpage' );
		}
	});

	editor.addButton( 'wp_help', {
		tooltip: 'Help',
		cmd: 'WP_Help'
	});

	// Menubar
	// Insert->Add Media
	if ( typeof wp !== 'undefined' && wp.media && wp.media.editor ) {
		editor.addMenuItem( 'add_media', {
			text: 'Add Media',
			context: 'insert',
			cmd: 'WP_Medialib'
		});
	}

	// Insert "Read More..."
	editor.addMenuItem( 'wp_more', {
		text: 'Insert Read More tag',
		context: 'insert',
		onclick: function() {
			editor.execCommand( 'WP_More', 'more' );
		}
	});

	// Insert "Next Page"
	editor.addMenuItem( 'wp_page', {
		text: 'Page break',
		context: 'insert',
		onclick: function() {
			editor.execCommand( 'WP_More', 'nextpage' );
		}
	});

	editor.on( 'BeforeExecCommand', function(e) {
		if ( tinymce.Env.webkit && ( e.command === 'InsertUnorderedList' || e.command === 'InsertOrderedList' ) ) {
			if ( ! style ) {
				style = editor.dom.create( 'style', {'type': 'text/css'},
					'#tinymce,#tinymce span,#tinymce li,#tinymce li>span,#tinymce p,#tinymce p>span{font:medium sans-serif;color:#000;line-height:normal;}');
			}

			editor.getDoc().head.appendChild( style );
		}
	});

	editor.on( 'ExecCommand', function( e ) {
		if ( tinymce.Env.webkit && style &&
			( 'InsertUnorderedList' === e.command || 'InsertOrderedList' === e.command ) ) {

			editor.dom.remove( style );
		}
	});

	editor.on( 'init', function() {
		var env = tinymce.Env,
			bodyClass = ['mceContentBody'], // back-compat for themes that use this in editor-style.css...
			body = editor.getBody();

		if ( editor.getParam( 'directionality' ) === 'rtl' ) {
			bodyClass.push('rtl');
		}

		if ( env.ie ) {
			if ( parseInt( env.ie, 10 ) === 9 ) {
				bodyClass.push('ie9');
			} else if ( parseInt( env.ie, 10 ) === 8 ) {
				bodyClass.push('ie8');
			} else if ( env.ie < 8 ) {
				bodyClass.push('ie7');
			}
		}

		bodyClass.push('wp-editor');

		tinymce.each( bodyClass, function( cls ) {
			if ( cls ) {
				editor.dom.addClass( body, cls );
			}
		});

		// Remove invalid parent paragraphs when inserting HTML
		// TODO: still needed?
		editor.on( 'BeforeSetContent', function( e ) {
			if ( e.content ) {
				e.content = e.content.replace(/<p>\s*<(p|div|ul|ol|dl|table|blockquote|h[1-6]|fieldset|pre|address)( [^>]*)?>/gi, '<$1$2>');
				e.content = e.content.replace(/<\/(p|div|ul|ol|dl|table|blockquote|h[1-6]|fieldset|pre|address)>\s*<\/p>/gi, '</$1>');
			}
		});

		if ( typeof window.jQuery !== 'undefined' ) {
			window.jQuery( document ).triggerHandler( 'tinymce-editor-init', [editor] );
		}
	});

	// Word count
	if ( typeof window.jQuery !== 'undefined' ) {
		editor.on( 'keyup', function( e ) {
			var key = e.keyCode || e.charCode;

			if ( key === last ) {
				return;
			}

			if ( 13 === key || 8 === last || 46 === last ) {
				window.jQuery( document ).triggerHandler( 'wpcountwords', [ editor.getContent({ format : 'raw' }) ] );
			}

			last = key;
		});
	}

	editor.on( 'SaveContent', function( e ) {
		// If editor is hidden, we just want the textarea's value to be saved
		if ( editor.isHidden() ) {
			e.content = e.element.value;
			return;
		}

		// Keep empty paragraphs :(
		e.content = e.content.replace( /<p>(<br ?\/?>|\u00a0|\uFEFF)?<\/p>/g, '<p>&nbsp;</p>' );

		if ( editor.getParam( 'wpautop', true ) && typeof switchEditors !== 'undefined' ) {
			e.content = switchEditors.pre_wpautop( e.content );
		}
	});

	// Add custom shortcuts
	modKey = 'alt+shift';

	editor.addShortcut( modKey + '+c', '', 'JustifyCenter' );
	editor.addShortcut( modKey + '+r', '', 'JustifyRight' );
	editor.addShortcut( modKey + '+l', '', 'JustifyLeft' );
	editor.addShortcut( modKey + '+j', '', 'JustifyFull' );
	editor.addShortcut( modKey + '+q', '', 'mceBlockQuote' );
	editor.addShortcut( modKey + '+u', '', 'InsertUnorderedList' );
	editor.addShortcut( modKey + '+o', '', 'InsertOrderedList' );
	editor.addShortcut( modKey + '+n', '', 'mceSpellCheck' );
	editor.addShortcut( modKey + '+a', '', 'WP_Link' );
	editor.addShortcut( modKey + '+s', '', 'unlink' );
	editor.addShortcut( modKey + '+m', '', 'WP_Medialib' );
	editor.addShortcut( modKey + '+z', '', 'WP_Adv' );
	editor.addShortcut( modKey + '+t', '', 'WP_More' );
	editor.addShortcut( modKey + '+d', '', 'Strikethrough' );
	editor.addShortcut( modKey + '+h', '', 'WP_Help' );
	editor.addShortcut( modKey + '+p', '', 'WP_Page' );
	editor.addShortcut( 'ctrl+s', '', function() {
		if ( typeof wp !== 'undefined' && wp.autosave ) {
			wp.autosave.server.triggerSave();
		}
	});

	// popup buttons for the gallery, etc.
	editor.on( 'init', function() {
		editor.dom.bind( editor.getWin(), 'scroll', function() {
			_hideButtons();
		});

		editor.dom.bind( editor.getBody(), 'dragstart', function() {
			_hideButtons();
		});
	});

	editor.on( 'BeforeExecCommand', function() {
		_hideButtons();
	});

	editor.on( 'SaveContent', function() {
		_hideButtons();
	});

	editor.on( 'MouseDown', function( e ) {
		if ( e.target.nodeName !== 'IMG' ) {
			_hideButtons();
		}
	});

	editor.on( 'keydown', function( e ) {
		if ( e.which === tinymce.util.VK.DELETE || e.which === tinymce.util.VK.BACKSPACE ) {
			_hideButtons();
		}
	});

	// Internal functions
	function _setEmbed( c ) {
		return c.replace( /\[embed\]([\s\S]+?)\[\/embed\][\s\u00a0]*/g, function( a, b ) {
			return '<img width="300" height="200" src="' + tinymce.Env.transparentSrc + '" class="wp-oembed" ' +
				'alt="'+ b +'" title="'+ b +'" data-mce-resize="false" data-mce-placeholder="1" />';
		});
	}

	function _getEmbed( c ) {
		return c.replace( /<img[^>]+>/g, function( a ) {
			if ( a.indexOf('class="wp-oembed') !== -1 ) {
				var u = a.match( /alt="([^\"]+)"/ );

				if ( u[1] ) {
					a = '[embed]' + u[1] + '[/embed]';
				}
			}

			return a;
		});
	}

	function _showButtons( n, id ) {
		var p1, p2, vp, X, Y;

		vp = editor.dom.getViewPort( editor.getWin() );
		p1 = DOM.getPos( editor.getContentAreaContainer() );
		p2 = editor.dom.getPos( n );

		X = Math.max( p2.x - vp.x, 0 ) + p1.x;
		Y = Math.max( p2.y - vp.y, 0 ) + p1.y;

		DOM.setStyles( id, {
			'top' : Y + 5 + 'px',
			'left' : X + 5 + 'px',
			'display': 'block'
		});
	}

	function _hideButtons() {
		DOM.hide( DOM.select( '#wp_editbtns, #wp_gallerybtns' ) );
	}

	// Expose some functions (back-compat)
	return {
		_showButtons: _showButtons,
		_hideButtons: _hideButtons,
		_setEmbed: _setEmbed,
		_getEmbed: _getEmbed
	};
});
