(function ($) {

/**
 * Attaches the autocomplete behavior to all required fields.
 */
Drupal.behaviors.autocomplete = {
  attach: function (context, settings) {
    var acdb = [];
    $('input.autocomplete', context).once('autocomplete', function () {
      var uri = this.value;
      if (!acdb[uri]) {
        acdb[uri] = new Drupal.ACDB(uri);
      }
      var $input = $('#' + this.id.substr(0, this.id.length - 13))
        .attr('autocomplete', 'OFF')
        .attr('aria-autocomplete', 'list');
      $($input[0].form).submit(Drupal.autocompleteSubmit);
      $input.parent()
        .attr('role', 'application')
        .append($('<span class="element-invisible" aria-live="assertive"></span>')
          .attr('id', $input.attr('id') + '-autocomplete-aria-live')
        );
      new Drupal.jsAC($input, acdb[uri]);
    });
  }
};

/**
 * Prevents the form from submitting if the suggestions popup is open
 * and closes the suggestions popup when doing so.
 */
Drupal.autocompleteSubmit = function () {
  return $('#autocomplete').each(function () {
    this.owner.hidePopup();
  }).length == 0;
};

/**
 * An AutoComplete object.
 */
Drupal.jsAC = function ($input, db) {
  var ac = this;
  this.input = $input[0];
  this.ariaLive = $('#' + this.input.id + '-autocomplete-aria-live');
  this.db = db;

  $input
    .keydown(function (event) { return ac.onkeydown(this, event); })
    .keyup(function (event) { ac.onkeyup(this, event); })
    .blur(function () { ac.hidePopup(); ac.db.cancel(); });

};

/**
 * Handler for the "keydown" event.
 */
Drupal.jsAC.prototype.onkeydown = function (input, e) {
  if (!e) {
    e = window.event;
  }
  switch (e.keyCode) {
    case 40: // down arrow.
      this.selectDown();
      return false;
    case 38: // up arrow.
      this.selectUp();
      return false;
    default: // All other keys.
      return true;
  }
};

/**
 * Handler for the "keyup" event.
 */
Drupal.jsAC.prototype.onkeyup = function (input, e) {
  if (!e) {
    e = window.event;
  }
  switch (e.keyCode) {
    case 16: // Shift.
    case 17: // Ctrl.
    case 18: // Alt.
    case 20: // Caps lock.
    case 33: // Page up.
    case 34: // Page down.
    case 35: // End.
    case 36: // Home.
    case 37: // Left arrow.
    case 38: // Up arrow.
    case 39: // Right arrow.
    case 40: // Down arrow.
      return true;

    case 9:  // Tab.
    case 13: // Enter.
    case 27: // Esc.
      this.hidePopup(e.keyCode);
      return true;

    default: // All other keys.
      if (input.value.length > 0 && !input.readOnly) {
        this.populatePopup();
      }
      else {
        this.hidePopup(e.keyCode);
      }
      return true;
  }
};

/**
 * Puts the currently highlighted suggestion into the autocomplete field.
 */
Drupal.jsAC.prototype.select = function (node) {
  this.input.value = $(node).data('autocompleteValue');
  $(this.input).trigger('autocompleteSelect', [node]);
};

/**
 * Highlights the next suggestion.
 */
Drupal.jsAC.prototype.selectDown = function () {
  if (this.selected && this.selected.nextSibling) {
    this.highlight(this.selected.nextSibling);
  }
  else if (this.popup) {
    var lis = $('li', this.popup);
    if (lis.length > 0) {
      this.highlight(lis.get(0));
    }
  }
};

/**
 * Highlights the previous suggestion.
 */
Drupal.jsAC.prototype.selectUp = function () {
  if (this.selected && this.selected.previousSibling) {
    this.highlight(this.selected.previousSibling);
  }
};

/**
 * Highlights a suggestion.
 */
Drupal.jsAC.prototype.highlight = function (node) {
  if (this.selected) {
    $(this.selected).removeClass('selected');
  }
  $(node).addClass('selected');
  this.selected = node;
  $(this.ariaLive).html($(this.selected).html());
};

/**
 * Unhighlights a suggestion.
 */
Drupal.jsAC.prototype.unhighlight = function (node) {
  $(node).removeClass('selected');
  this.selected = false;
  $(this.ariaLive).empty();
};

/**
 * Hides the autocomplete suggestions.
 */
Drupal.jsAC.prototype.hidePopup = function (keycode) {
  // Select item if the right key or mousebutton was pressed.
  if (this.selected && ((keycode && keycode != 46 && keycode != 8 && keycode != 27) || !keycode)) {
    this.select(this.selected);
  }
  // Hide popup.
  var popup = this.popup;
  if (popup) {
    this.popup = null;
    $(popup).fadeOut('fast', function () { $(popup).remove(); });
  }
  this.selected = false;
  $(this.ariaLive).empty();
};

/**
 * Positions the suggestions popup and starts a search.
 */
Drupal.jsAC.prototype.populatePopup = function () {
  var $input = $(this.input);
  var position = $input.position();
  // Show popup.
  if (this.popup) {
    $(this.popup).remove();
  }
  this.selected = false;
  this.popup = $('<div id="autocomplete"></div>')[0];
  this.popup.owner = this;
  $(this.popup).css({
    top: parseInt(position.top + this.input.offsetHeight, 10) + 'px',
    left: parseInt(position.left, 10) + 'px',
    width: $input.innerWidth() + 'px',
    display: 'none'
  });
  $input.before(this.popup);

  // Do search.
  this.db.owner = this;
  this.db.search(this.input.value);
};

/**
 * Fills the suggestion popup with any matches received.
 */
Drupal.jsAC.prototype.found = function (matches) {
  // If no value in the textfield, do not show the popup.
  if (!this.input.value.length) {
    return false;
  }

  // Prepare matches.
  var ul = $('<ul></ul>');
  var ac = this;
  for (key in matches) {
    $('<li></li>')
      .html($('<div></div>').html(matches[key]))
      .mousedown(function () { ac.hidePopup(this); })
      .mouseover(function () { ac.highlight(this); })
      .mouseout(function () { ac.unhighlight(this); })
      .data('autocompleteValue', key)
      .appendTo(ul);
  }

  // Show popup with matches, if any.
  if (this.popup) {
    if (ul.children().length) {
      $(this.popup).empty().append(ul).show();
      $(this.ariaLive).html(Drupal.t('Autocomplete popup'));
    }
    else {
      $(this.popup).css({ visibility: 'hidden' });
      this.hidePopup();
    }
  }
};

Drupal.jsAC.prototype.setStatus = function (status) {
  switch (status) {
    case 'begin':
      $(this.input).addClass('throbbing');
      $(this.ariaLive).html(Drupal.t('Searching for matches...'));
      break;
    case 'cancel':
    case 'error':
    case 'found':
      $(this.input).removeClass('throbbing');
      break;
  }
};

/**
 * An AutoComplete DataBase object.
 */
Drupal.ACDB = function (uri) {
  this.uri = uri;
  this.delay = 300;
  this.cache = {};
};

/**
 * Performs a cached and delayed search.
 */
Drupal.ACDB.prototype.search = function (searchString) {
  var db = this;
  this.searchString = searchString;

  // See if this string needs to be searched for anyway. The pattern ../ is
  // stripped since it may be misinterpreted by the browser.
  searchString = searchString.replace(/^\s+|\.{2,}\/|\s+$/g, '');
  // Skip empty search strings, or search strings ending with a comma, since
  // that is the separator between search terms.
  if (searchString.length <= 0 ||
    searchString.charAt(searchString.length - 1) == ',') {
    return;
  }

  // See if this key has been searched for before.
  if (this.cache[searchString]) {
    return this.owner.found(this.cache[searchString]);
  }

  // Initiate delayed search.
  if (this.timer) {
    clearTimeout(this.timer);
  }
  this.timer = setTimeout(function () {
    db.owner.setStatus('begin');

    // Ajax GET request for autocompletion. We use Drupal.encodePath instead of
    // encodeURIComponent to allow autocomplete search terms to contain slashes.
    $.ajax({
      type: 'GET',
      url: db.uri + '/' + Drupal.encodePath(searchString),
      dataType: 'json',
      success: function (matches) {
        if (typeof matches.status == 'undefined' || matches.status != 0) {
          db.cache[searchString] = matches;
          // Verify if these are still the matches the user wants to see.
          if (db.searchString == searchString) {
            db.owner.found(matches);
          }
          db.owner.setStatus('found');
        }
      },
      error: function (xmlhttp) {
        Drupal.displayAjaxError(Drupal.ajaxError(xmlhttp, db.uri));
      }
    });
  }, this.delay);
};

/**
 * Cancels the current autocomplete request.
 */
Drupal.ACDB.prototype.cancel = function () {
  if (this.owner) this.owner.setStatus('cancel');
  if (this.timer) clearTimeout(this.timer);
  this.searchString = '';
};

})(jQuery);
;
/**
 * @file views_load_more.js
 *
 * Handles the AJAX pager for the view_load_more plugin.
 */
(function ($) {

  /**
   * Provide a series of commands that the server can request the client perform.
   */
  Drupal.ajax.prototype.commands.viewsLoadMoreAppend = function (ajax, response, status) {
    // Get information from the response. If it is not there, default to
    // our presets.
    var wrapper = response.selector ? $(response.selector) : $(ajax.wrapper);
    var method = response.method || ajax.method;
    var targetList = response.targetList || '';
    var effect = ajax.getEffect(response);
    var pager_selector = response.options.pager_selector ? response.options.pager_selector : '.pager-load-more';

    // We don't know what response.data contains: it might be a string of text
    // without HTML, so don't rely on jQuery correctly iterpreting
    // $(response.data) as new HTML rather than a CSS selector. Also, if
    // response.data contains top-level text nodes, they get lost with either
    // $(response.data) or $('<div></div>').replaceWith(response.data).
    var new_content_wrapped = $('<div></div>').html(response.data);
    var new_content = new_content_wrapped.contents();

    // For legacy reasons, the effects processing code assumes that new_content
    // consists of a single top-level element. Also, it has not been
    // sufficiently tested whether attachBehaviors() can be successfully called
    // with a context object that includes top-level text nodes. However, to
    // give developers full control of the HTML appearing in the page, and to
    // enable Ajax content to be inserted in places where DIV elements are not
    // allowed (e.g., within TABLE, TR, and SPAN parents), we check if the new
    // content satisfies the requirement of a single top-level element, and
    // only use the container DIV created above when it doesn't. For more
    // information, please see http://drupal.org/node/736066.
    if (new_content.length != 1 || new_content.get(0).nodeType != 1) {
      new_content = new_content_wrapped;
    }
    // If removing content from the wrapper, detach behaviors first.
    var settings = response.settings || ajax.settings || Drupal.settings;
    Drupal.detachBehaviors(wrapper, settings);
    if ($.waypoints != undefined) {
      $.waypoints('refresh');
    }

    // Set up our default query options. This is for advance users that might
    // change there views layout classes. This allows them to write there own
    // jquery selector to replace the content with.
    // Provide sensible defaults for unordered list, ordered list and table
    // view styles.
    var content_query = targetList && !response.options.content ? '> .view-content ' + targetList : response.options.content || '> .view-content';

    // If we're using any effects. Hide the new content before adding it to the DOM.
    if (effect.showEffect != 'show') {
      new_content.find(content_query).children().hide();
    }

    // Update the pager
    // Find both for the wrapper as the newly loaded content the direct child
    // .item-list in case of nested pagers
    wrapper.find(pager_selector).replaceWith(new_content.find(pager_selector));

    // Add the new content to the page.
    wrapper.find(content_query)[method](new_content.find(content_query).children());

    // Re-class the loaded content.
    // @todo this is faulty in many ways.  first of which is that user may have configured view to not have these classes at all.
    wrapper.find(content_query).children()
      .removeClass('views-row-first views-row-last views-row-odd views-row-even')
      .filter(':first')
        .addClass('views-row-first')
        .end()
      .filter(':last')
        .addClass('views-row-last')
        .end()
      .filter(':even')
        .addClass('views-row-odd')
        .end()
      .filter(':odd')
        .addClass('views-row-even')
        .end();

    if (effect.showEffect != 'show') {
      wrapper.find(content_query).children(':not(:visible)')[effect.showEffect](effect.showSpeed);
    }

    // Additional processing over new content
    wrapper.trigger('views_load_more.new_content', new_content.clone());

    // Attach all JavaScript behaviors to the new content
    // Remove the Jquery once Class, TODO: There needs to be a better
    // way of doing this, look at .removeOnce() :-/
    var classes = wrapper.attr('class');
    var onceClass = classes.match(/jquery-once-[0-9]*-[a-z]*/);
    wrapper.removeClass(onceClass[0]);
    settings = response.settings || ajax.settings || Drupal.settings;
    Drupal.attachBehaviors(wrapper, settings);
  };

  /**
   * Attaches the AJAX behavior to Views Load More waypoint support.
   */
  Drupal.behaviors.ViewsLoadMore = {
    attach: function (context, settings) {
      var default_opts = {
          offset: '100%'
        };

      if (settings && settings.viewsLoadMore && settings.views && settings.views.ajaxViews) {
        $.each(settings.viewsLoadMore, function(i, setting) {
          var view = '.view-id-' + setting.view_name + '.view-display-id-' + setting.view_display_id + ' .pager-next a',
            opts = {};

          $.extend(opts, default_opts, settings.viewsLoadMore[i].opts);

          $(view).waypoint('destroy');
          $(view).waypoint(function(event, direction) {
            $(view).click();
          }, opts);
        });
      }
    },
    detach: function (context, settings, trigger) {
      if (settings && settings.viewsLoadMore && settings.views && settings.views.ajaxViews) {
        $.each(settings.viewsLoadMore, function(i, setting) {
          var view = '.view-id-' + setting.view_name + '.view-display-id-' + setting.view_display_id;
          if ($(context).is(view)) {
            $('.pager-next a', view).waypoint('destroy');
          }
          else {
            $(view, context).waypoint('destroy');
          }
        });
      }
    }
  };
})(jQuery);
;
(function ($) {

/**
 * Attaches sticky table headers.
 */
Drupal.behaviors.tableHeader = {
  attach: function (context, settings) {
    if (!$.support.positionFixed) {
      return;
    }

    $('table.sticky-enabled', context).once('tableheader', function () {
      $(this).data("drupal-tableheader", new Drupal.tableHeader(this));
    });
  }
};

/**
 * Constructor for the tableHeader object. Provides sticky table headers.
 *
 * @param table
 *   DOM object for the table to add a sticky header to.
 */
Drupal.tableHeader = function (table) {
  var self = this;

  this.originalTable = $(table);
  this.originalHeader = $(table).children('thead');
  this.originalHeaderCells = this.originalHeader.find('> tr > th');
  this.displayWeight = null;

  // React to columns change to avoid making checks in the scroll callback.
  this.originalTable.bind('columnschange', function (e, display) {
    // This will force header size to be calculated on scroll.
    self.widthCalculated = (self.displayWeight !== null && self.displayWeight === display);
    self.displayWeight = display;
  });

  // Clone the table header so it inherits original jQuery properties. Hide
  // the table to avoid a flash of the header clone upon page load.
  this.stickyTable = $('<table class="sticky-header"/>')
    .insertBefore(this.originalTable)
    .css({ position: 'fixed', top: '0px' });
  this.stickyHeader = this.originalHeader.clone(true)
    .hide()
    .appendTo(this.stickyTable);
  this.stickyHeaderCells = this.stickyHeader.find('> tr > th');

  this.originalTable.addClass('sticky-table');
  $(window)
    .bind('scroll.drupal-tableheader', $.proxy(this, 'eventhandlerRecalculateStickyHeader'))
    .bind('resize.drupal-tableheader', { calculateWidth: true }, $.proxy(this, 'eventhandlerRecalculateStickyHeader'))
    // Make sure the anchor being scrolled into view is not hidden beneath the
    // sticky table header. Adjust the scrollTop if it does.
    .bind('drupalDisplaceAnchor.drupal-tableheader', function () {
      window.scrollBy(0, -self.stickyTable.outerHeight());
    })
    // Make sure the element being focused is not hidden beneath the sticky
    // table header. Adjust the scrollTop if it does.
    .bind('drupalDisplaceFocus.drupal-tableheader', function (event) {
      if (self.stickyVisible && event.clientY < (self.stickyOffsetTop + self.stickyTable.outerHeight()) && event.$target.closest('sticky-header').length === 0) {
        window.scrollBy(0, -self.stickyTable.outerHeight());
      }
    })
    .triggerHandler('resize.drupal-tableheader');

  // We hid the header to avoid it showing up erroneously on page load;
  // we need to unhide it now so that it will show up when expected.
  this.stickyHeader.show();
};

/**
 * Event handler: recalculates position of the sticky table header.
 *
 * @param event
 *   Event being triggered.
 */
Drupal.tableHeader.prototype.eventhandlerRecalculateStickyHeader = function (event) {
  var self = this;
  var calculateWidth = event.data && event.data.calculateWidth;

  // Reset top position of sticky table headers to the current top offset.
  this.stickyOffsetTop = Drupal.settings.tableHeaderOffset ? eval(Drupal.settings.tableHeaderOffset + '()') : 0;
  this.stickyTable.css('top', this.stickyOffsetTop + 'px');

  // Save positioning data.
  var viewHeight = document.documentElement.scrollHeight || document.body.scrollHeight;
  if (calculateWidth || this.viewHeight !== viewHeight) {
    this.viewHeight = viewHeight;
    this.vPosition = this.originalTable.offset().top - 4 - this.stickyOffsetTop;
    this.hPosition = this.originalTable.offset().left;
    this.vLength = this.originalTable[0].clientHeight - 100;
    calculateWidth = true;
  }

  // Track horizontal positioning relative to the viewport and set visibility.
  var hScroll = document.documentElement.scrollLeft || document.body.scrollLeft;
  var vOffset = (document.documentElement.scrollTop || document.body.scrollTop) - this.vPosition;
  this.stickyVisible = vOffset > 0 && vOffset < this.vLength;
  this.stickyTable.css({ left: (-hScroll + this.hPosition) + 'px', visibility: this.stickyVisible ? 'visible' : 'hidden' });

  // Only perform expensive calculations if the sticky header is actually
  // visible or when forced.
  if (this.stickyVisible && (calculateWidth || !this.widthCalculated)) {
    this.widthCalculated = true;
    var $that = null;
    var $stickyCell = null;
    var display = null;
    var cellWidth = null;
    // Resize header and its cell widths.
    // Only apply width to visible table cells. This prevents the header from
    // displaying incorrectly when the sticky header is no longer visible.
    for (var i = 0, il = this.originalHeaderCells.length; i < il; i += 1) {
      $that = $(this.originalHeaderCells[i]);
      $stickyCell = this.stickyHeaderCells.eq($that.index());
      display = $that.css('display');
      if (display !== 'none') {
        cellWidth = $that.css('width');
        // Exception for IE7.
        if (cellWidth === 'auto') {
          cellWidth = $that[0].clientWidth + 'px';
        }
        $stickyCell.css({'width': cellWidth, 'display': display});
      }
      else {
        $stickyCell.css('display', 'none');
      }
    }
    this.stickyTable.css('width', this.originalTable.outerWidth());
  }
};

})(jQuery);
;
/**
 * @file
 * Some basic behaviors and utility functions for Views.
 */
(function ($) {

  Drupal.Views = {};

  /**
   * JQuery UI tabs, Views integration component.
   */
  Drupal.behaviors.viewsTabs = {
    attach: function (context) {
      if ($.viewsUi && $.viewsUi.tabs) {
        $('#views-tabset').once('views-processed').viewsTabs({
          selectedClass: 'active'
        });
      }

      $('a.views-remove-link').once('views-processed').click(function(event) {
        var id = $(this).attr('id').replace('views-remove-link-', '');
        $('#views-row-' + id).hide();
        $('#views-removed-' + id).attr('checked', true);
        event.preventDefault();
      });
      /**
    * Here is to handle display deletion
    * (checking in the hidden checkbox and hiding out the row).
    */
      $('a.display-remove-link')
        .addClass('display-processed')
        .click(function() {
          var id = $(this).attr('id').replace('display-remove-link-', '');
          $('#display-row-' + id).hide();
          $('#display-removed-' + id).attr('checked', true);
          return false;
        });
    }
  };

  /**
 * Helper function to parse a querystring.
 */
  Drupal.Views.parseQueryString = function (query) {
    var args = {};
    var pos = query.indexOf('?');
    if (pos != -1) {
      query = query.substring(pos + 1);
    }
    var pairs = query.split('&');
    for (var i in pairs) {
      if (typeof(pairs[i]) == 'string') {
        var pair = pairs[i].split('=');
        // Ignore the 'q' path argument, if present.
        if (pair[0] != 'q' && pair[1]) {
          args[decodeURIComponent(pair[0].replace(/\+/g, ' '))] = decodeURIComponent(pair[1].replace(/\+/g, ' '));
        }
      }
    }
    return args;
  };

  /**
 * Helper function to return a view's arguments based on a path.
 */
  Drupal.Views.parseViewArgs = function (href, viewPath) {

    // Provide language prefix.
    if (Drupal.settings.pathPrefix) {
      var viewPath = Drupal.settings.pathPrefix + viewPath;
    }
    var returnObj = {};
    var path = Drupal.Views.getPath(href);
    // Ensure we have a correct path.
    if (viewPath && path.substring(0, viewPath.length + 1) == viewPath + '/') {
      var args = decodeURIComponent(path.substring(viewPath.length + 1, path.length));
      returnObj.view_args = args;
      returnObj.view_path = path;
    }
    return returnObj;
  };

  /**
 * Strip off the protocol plus domain from an href.
 */
  Drupal.Views.pathPortion = function (href) {
    // Remove e.g. http://example.com if present.
    var protocol = window.location.protocol;
    if (href.substring(0, protocol.length) == protocol) {
      // 2 is the length of the '//' that normally follows the protocol.
      href = href.substring(href.indexOf('/', protocol.length + 2));
    }
    return href;
  };

  /**
 * Return the Drupal path portion of an href.
 */
  Drupal.Views.getPath = function (href) {
    href = Drupal.Views.pathPortion(href);
    href = href.substring(Drupal.settings.basePath.length, href.length);
    // 3 is the length of the '?q=' added to the url without clean urls.
    if (href.substring(0, 3) == '?q=') {
      href = href.substring(3, href.length);
    }
    var chars = ['#', '?', '&'];
    for (var i in chars) {
      if (href.indexOf(chars[i]) > -1) {
        href = href.substr(0, href.indexOf(chars[i]));
      }
    }
    return href;
  };

})(jQuery);
;
(function ($) {

/**
 * A progressbar object. Initialized with the given id. Must be inserted into
 * the DOM afterwards through progressBar.element.
 *
 * method is the function which will perform the HTTP request to get the
 * progress bar state. Either "GET" or "POST".
 *
 * e.g. pb = new progressBar('myProgressBar');
 *      some_element.appendChild(pb.element);
 */
Drupal.progressBar = function (id, updateCallback, method, errorCallback) {
  var pb = this;
  this.id = id;
  this.method = method || 'GET';
  this.updateCallback = updateCallback;
  this.errorCallback = errorCallback;

  // The WAI-ARIA setting aria-live="polite" will announce changes after users
  // have completed their current activity and not interrupt the screen reader.
  this.element = $('<div class="progress" aria-live="polite"></div>').attr('id', id);
  this.element.html('<div class="bar"><div class="filled"></div></div>' +
                    '<div class="percentage"></div>' +
                    '<div class="message">&nbsp;</div>');
};

/**
 * Set the percentage and status message for the progressbar.
 */
Drupal.progressBar.prototype.setProgress = function (percentage, message) {
  if (percentage >= 0 && percentage <= 100) {
    $('div.filled', this.element).css('width', percentage + '%');
    $('div.percentage', this.element).html(percentage + '%');
  }
  $('div.message', this.element).html(message);
  if (this.updateCallback) {
    this.updateCallback(percentage, message, this);
  }
};

/**
 * Start monitoring progress via Ajax.
 */
Drupal.progressBar.prototype.startMonitoring = function (uri, delay) {
  this.delay = delay;
  this.uri = uri;
  this.sendPing();
};

/**
 * Stop monitoring progress via Ajax.
 */
Drupal.progressBar.prototype.stopMonitoring = function () {
  clearTimeout(this.timer);
  // This allows monitoring to be stopped from within the callback.
  this.uri = null;
};

/**
 * Request progress data from server.
 */
Drupal.progressBar.prototype.sendPing = function () {
  if (this.timer) {
    clearTimeout(this.timer);
  }
  if (this.uri) {
    var pb = this;
    // When doing a post request, you need non-null data. Otherwise a
    // HTTP 411 or HTTP 406 (with Apache mod_security) error may result.
    $.ajax({
      type: this.method,
      url: this.uri,
      data: '',
      dataType: 'json',
      success: function (progress) {
        // Display errors.
        if (progress.status == 0) {
          pb.displayError(progress.data);
          return;
        }
        // Update display.
        pb.setProgress(progress.percentage, progress.message);
        // Schedule next timer.
        pb.timer = setTimeout(function () { pb.sendPing(); }, pb.delay);
      },
      error: function (xmlhttp) {
        pb.displayError(Drupal.ajaxError(xmlhttp, pb.uri));
      }
    });
  }
};

/**
 * Display errors on the page.
 */
Drupal.progressBar.prototype.displayError = function (string) {
  var error = $('<div class="messages error"></div>').html(string);
  $(this.element).before(error).hide();

  if (this.errorCallback) {
    this.errorCallback(this);
  }
};

})(jQuery);
;
/**
 * @file
 * Handles AJAX fetching of views, including filter submission and response.
 */
(function ($) {

  /**
   * Attaches the AJAX behavior to exposed filter forms and key views links.
   */
  Drupal.behaviors.ViewsAjaxView = {};
  Drupal.behaviors.ViewsAjaxView.attach = function() {
    if (Drupal.settings && Drupal.settings.views && Drupal.settings.views.ajaxViews) {
      $.each(Drupal.settings.views.ajaxViews, function(i, settings) {
        Drupal.views.instances[i] = new Drupal.views.ajaxView(settings);
      });
    }
  };

  Drupal.views = {};
  Drupal.views.instances = {};

  /**
   * JavaScript object for a certain view.
   */
  Drupal.views.ajaxView = function(settings) {
    var selector = '.view-dom-id-' + settings.view_dom_id;
    this.$view = $(selector);

    // Retrieve the path to use for views' ajax.
    var ajax_path = Drupal.settings.views.ajax_path;

    // If there are multiple views this might've ended up showing up multiple
    // times.
    if (ajax_path.constructor.toString().indexOf("Array") != -1) {
      ajax_path = ajax_path[0];
    }

    // Check if there are any GET parameters to send to views.
    var queryString = window.location.search || '';
    if (queryString !== '') {
      // Remove the question mark and Drupal path component if any.
      var queryString = queryString.slice(1).replace(/q=[^&]+&?|&?render=[^&]+/, '');
      if (queryString !== '') {
        // If there is a '?' in ajax_path, clean url are on and & should be
        // used to add parameters.
        queryString = ((/\?/.test(ajax_path)) ? '&' : '?') + queryString;
      }
    }

    this.element_settings = {
      url: ajax_path + queryString,
      submit: settings,
      setClick: true,
      event: 'click',
      selector: selector,
      progress: {
        type: 'throbber'
      }
    };

    this.settings = settings;

    // Add the ajax to exposed forms.
    this.$exposed_form = $(selector + ' #views-exposed-form-' + settings.view_name.replace(/_/g, '-') + '-' + settings.view_display_id.replace(/_/g, '-'));
    this.$exposed_form.once(jQuery.proxy(this.attachExposedFormAjax, this));

    // Store Drupal.ajax objects here for all pager links.
    this.links = [];

    // Add the ajax to pagers.
    this.$view
      .once(jQuery.proxy(this.attachPagerAjax, this));

    // Add a trigger to update this view specifically. In order to trigger a
    // refresh use the following code.
    //
    // @code
    // jQuery('.view-name').trigger('RefreshView');
    // @endcode
    // Add a trigger to update this view specifically.
    var self_settings = this.element_settings;
    self_settings.event = 'RefreshView';
    this.refreshViewAjax = new Drupal.ajax(this.selector, this.$view, self_settings);
  };

  Drupal.views.ajaxView.prototype.attachExposedFormAjax = function() {
    var button = $('input[type=submit], button[type=submit], input[type=image]', this.$exposed_form);
    button = button[0];

    // Call the autocomplete submit before doing AJAX.
    $(button).click(function () {
      if (Drupal.autocompleteSubmit) {
        Drupal.autocompleteSubmit();
      }
    });

    this.exposedFormAjax = new Drupal.ajax($(button).attr('id'), button, this.element_settings);
  };

  /**
   * Attach the ajax behavior to each link.
   */
  Drupal.views.ajaxView.prototype.attachPagerAjax = function() {
    this.$view.find('ul.pager > li > a, th.views-field a, .attachment .views-summary a')
      .each(jQuery.proxy(this.attachPagerLinkAjax, this));
  };

  /**
   * Attach the ajax behavior to a singe link.
   */
  Drupal.views.ajaxView.prototype.attachPagerLinkAjax = function(id, link) {
    var $link = $(link);
    // Don't attach to pagers inside nested views.
    if ($link.closest('.view')[0] !== this.$view[0]) {
      return;
    }
    var viewData = {};
    var href = $link.attr('href');

    // Provide a default page if none has been set. This must be done
    // prior to merging with settings to avoid accidentally using the
    // page landed on instead of page 1.
    if (typeof(viewData.page) === 'undefined') {
      viewData.page = 0;
    }

    // Construct an object using the settings defaults and then overriding
    // with data specific to the link.
    $.extend(
    viewData,
    this.settings,
    Drupal.Views.parseQueryString(href),
    // Extract argument data from the URL.
    Drupal.Views.parseViewArgs(href, this.settings.view_base_path)
    );

    // For anchor tags, these will go to the target of the anchor rather
    // than the usual location.
    $.extend(viewData, Drupal.Views.parseViewArgs(href, this.settings.view_base_path));

    this.element_settings.submit = viewData;
    this.pagerAjax = new Drupal.ajax(false, $link, this.element_settings);
    this.links.push(this.pagerAjax);
  };

  Drupal.ajax.prototype.commands.viewsScrollTop = function (ajax, response, status) {
    // Scroll to the top of the view. This will allow users
    // to browse newly loaded content after e.g. clicking a pager
    // link.
    var offset = $(response.selector).offset();
    // We can't guarantee that the scrollable object should be
    // the body, as the view could be embedded in something
    // more complex such as a modal popup. Recurse up the DOM
    // and scroll the first element that has a non-zero top.
    var scrollTarget = response.selector;
    while ($(scrollTarget).scrollTop() == 0 && $(scrollTarget).parent()) {
      scrollTarget = $(scrollTarget).parent();
    }
    // Only scroll upward.
    if (offset.top - 10 < $(scrollTarget).scrollTop()) {
      $(scrollTarget).animate({scrollTop: (offset.top - 10)}, 500);
    }
  };

})(jQuery);
;
(function ($) {
  // Polyfill for jQuery less than 1.6.
  if (typeof $.fn.prop != 'function') {
    jQuery.fn.extend({
      prop: jQuery.fn.attr
    });
  }

  Drupal.behaviors.vbo = {
    attach: function(context) {
      $('.vbo-views-form', context).each(function() {
        Drupal.vbo.initTableBehaviors(this);
        Drupal.vbo.initGenericBehaviors(this);
        Drupal.vbo.toggleButtonsState(this);
      });
    }
  }

  Drupal.vbo = Drupal.vbo || {};
  Drupal.vbo.initTableBehaviors = function(form) {
    // If the table is not grouped, "Select all on this page / all pages"
    // markup gets inserted below the table header.
    var selectAllMarkup = $('.vbo-table-select-all-markup', form);
    if (selectAllMarkup.length) {
      $('.views-table > tbody', form).prepend('<tr class="views-table-row-select-all even">></tr>');
      var colspan = $('table th', form).length;
      $('.views-table-row-select-all', form).html('<td colspan="' + colspan + '">' + selectAllMarkup.html() + '</td>');

      $('.vbo-table-select-all-pages', form).click(function() {
        Drupal.vbo.tableSelectAllPages(form);
        return false;
      });
      $('.vbo-table-select-this-page', form).click(function() {
        Drupal.vbo.tableSelectThisPage(form);
        return false;
      });
    }

    $('.vbo-table-select-all', form).show();
    // This is the "select all" checkbox in (each) table header.
    $('input.vbo-table-select-all', form).click(function() {
      var table = $(this).closest('table:not(.sticky-header)')[0];
      $('.vbo-select:not(:disabled)', table).prop('checked', this.checked);
      Drupal.vbo.toggleButtonsState(form);

      // Toggle the visibility of the "select all" row (if any).
      if (this.checked) {
        $('.views-table-row-select-all', table).show();
      }
      else {
        $('.views-table-row-select-all', table).hide();
        // Disable "select all across pages".
        Drupal.vbo.tableSelectThisPage(form);
      }
    });

    // Set up the ability to click anywhere on the row to select it.
    if (Drupal.settings.vbo.row_clickable) {
      $('.views-table tbody tr', form).click(function(event) {
        var tagName = event.target.tagName.toLowerCase();
        if (tagName != 'input' && tagName != 'a' && tagName != 'label') {
          $('.vbo-select:not(:disabled)', this).each(function() {
            // Always return true for radios, you cannot de-select a radio by clicking on it,
            // it should be the same when clicking on a row.
            this.checked = $(this).is(':radio') ? true : !this.checked;
            $(this).trigger('change');
          });
        }
      });
    }
  }

  Drupal.vbo.tableSelectAllPages = function(form) {
    $('.vbo-table-this-page', form).hide();
    $('.vbo-table-all-pages', form).show();
    // Modify the value of the hidden form field.
    $('.select-all-rows', form).val('1');
  }
  Drupal.vbo.tableSelectThisPage = function(form) {
    $('.vbo-table-all-pages', form).hide();
    $('.vbo-table-this-page', form).show();
    // Modify the value of the hidden form field.
    $('.select-all-rows', form).val('0');
  }

  Drupal.vbo.initGenericBehaviors = function(form) {
    // Show the "select all" fieldset.
    $('.vbo-select-all-markup', form).show();

    $('.vbo-select-this-page', form).click(function() {
      $('.vbo-select', form).prop('checked', this.checked);
      Drupal.vbo.toggleButtonsState(form);
      $('.vbo-select-all-pages', form).prop('checked', false);

      // Toggle the "select all" checkbox in grouped tables (if any).
      $('.vbo-table-select-all', form).prop('checked', this.checked);
    });
    $('.vbo-select-all-pages', form).click(function() {
      $('.vbo-select', form).prop('checked', this.checked);
      Drupal.vbo.toggleButtonsState(form);
      $('.vbo-select-this-page', form).prop('checked', false);

      // Toggle the "select all" checkbox in grouped tables (if any).
      $('.vbo-table-select-all', form).prop('checked', this.checked);

      // Modify the value of the hidden form field.
      $('.select-all-rows', form).val(this.checked);
    });

    // Toggle submit buttons' "disabled" states with the state of the operation
    // selectbox.
    $('select[name="operation"]', form).change(function () {
      Drupal.vbo.toggleButtonsState(form);
    });

    // Handle a "change" event originating either from a row click or an actual checkbox click.
    $('.vbo-select', form).change(function() {
      // If a checkbox was deselected, uncheck any "select all" checkboxes.
      if (!this.checked) {
        $('.vbo-select-this-page', form).prop('checked', false);
        $('.vbo-select-all-pages', form).prop('checked', false);
        // Modify the value of the hidden form field.
        $('.select-all-rows', form).val('0')

        var table = $(this).closest('table')[0];
        if (table) {
          // Uncheck the "select all" checkbox in the table header.
          $('.vbo-table-select-all', table).prop('checked', false);

          // If there's a "select all" row, hide it.
          if ($('.vbo-table-select-this-page', table).length) {
            $('.views-table-row-select-all', table).hide();
            // Disable "select all across pages".
            Drupal.vbo.tableSelectThisPage(form);
          }
        }
      }

      Drupal.vbo.toggleButtonsState(form);
    });
  }

  Drupal.vbo.toggleButtonsState = function(form) {
    // If no rows are checked, disable any form submit actions.
    var selectbox = $('select[name="operation"]', form);
    var checkedCheckboxes = $('.vbo-select:checked', form);
    // The .vbo-prevent-toggle CSS class is added to buttons to prevent toggling
    // between disabled and enabled. For example the case of an 'add' button.
    var buttons = $('[id^="edit-select"] [type="submit"]:not(.vbo-prevent-toggle)', form);

    if (selectbox.length) {
      var has_selection = checkedCheckboxes.length && selectbox.val() !== '0';
      buttons.prop('disabled', !has_selection);
    }
    else {
      buttons.prop('disabled', !checkedCheckboxes.length);
    }
  };

})(jQuery);
;
($ => {
  Drupal.behaviors.notificationsPopup = {
    attach: () => {
      function sendUserPopupAction(uid, answer, entityId, path, notificationTime) {
        Campuz.sockets.io.emit('presence_log', {answer: answer, uid: uid, entityId: entityId, path: path, notificationTime: notificationTime, "bounce": Campuz.sockets.bounce()});
      }

      $('body').once('popups', () => {

        if (typeof Campuz !== 'undefined' && Campuz.sockets.io) {
          Campuz.sockets.io.on('notification', (data) => {
            if (data.notificationData.type == 'popup') {
              const fullscreenPrefixes = [{
                fullscreen: 'fullscreenElement',
                close: 'exitFullscreen'
              }, {
                fullscreen: 'webkitFullscreenElement',
                close: 'webkitExitFullscreen'
              }, {
                fullscreen: 'mozRequestFullScreen',
                close: 'mozCancelFullScreen'
              },];

              let popup = $('#presence-popup');
              let popup_show = data.notificationData.content.popup_time ? data.notificationData.content.popup_time : 60;
              let uid = Drupal.settings.campuz.sockets.userId;
              let path = Drupal.settings.campuz.sockets.href;
              let popupStartTime = data.startTime;
              sendUserPopupAction(uid, 2, data.entityId, path, popupStartTime);
              popup_show = popup_show * 1000;
              if (!popup.length && Drupal.settings.campuz && Drupal.settings.campuz.popup) {
                fullscreenPrefixes.forEach((prefix) => {
                  if (document[prefix.fullscreen] != null) {
                    document[prefix.close]();
                  }
                });
                $('body').append(data.notificationData.content.template);
                setTimeout(() => {
                  let popup = $('#presence-popup');
                  if (popup.length) {
                    sendUserPopupAction(uid, 0, data.entityId, path, popupStartTime);
                    popup.remove();
                  }
                }, popup_show);
                $('#popup-accept-btn').click(() => {
                  sendUserPopupAction(uid, 1, data.entityId, path, popupStartTime);
                  $('#presence-popup').remove();
                });
              }
              window.addEventListener('beforeunload', (event) => {
                if ($('#presence-popup').length) {
                  sendUserPopupAction(uid, 0, data.entityId, path, popupStartTime);
                }
                event.preventDefault();
              });
            }
          });
        }
      });
    }
  };
})(jQuery);
;
;
/*!
	SlickNav Responsive Mobile Menu
	(c) 2014 Josh Cope
	licensed under MIT
*/
;(function ($, document, window) {
  var
    // default settings object.
    defaults = {
      label: 'MENU',
      duplicate: true,
      duration: 200,
      easingOpen: 'swing',
      easingClose: 'swing',
      closedSymbol: '&#9658;',
      openedSymbol: '&#9660;',
      prependTo: 'body',
      parentTag: 'a',
      closeOnClick: false,
      allowParentLinks: false,
      init: function () {
      },
      open: function () {
      },
      close: function () {
      }
    },
    mobileMenu = 'slicknav',
    prefix = 'slicknav';

  function Plugin(element, options) {
    this.element = element;

    // jQuery has an extend method which merges the contents of two or
    // more objects, storing the result in the first object. The first object
    // is generally empty as we don't want to alter the default options for
    // future instances of the plugin
    this.settings = $.extend({}, defaults, options);

    this._defaults = defaults;
    this._name = mobileMenu;

    this.init();
  }

  Plugin.prototype.init = function () {
    var $this = this;
    var menu = $(this.element);
    var settings = this.settings;

    // clone menu if needed
    if (settings.duplicate) {
      $this.mobileNav = menu.clone();
      //remove ids from clone to prevent css issues
      $this.mobileNav.removeAttr('id');
      $this.mobileNav.find('*').each(function (i, e) {
        $(e).removeAttr('id');
      });
    }
    else {
      $this.mobileNav = menu;
    }

    // styling class for the button
    var iconClass = prefix + '_icon';

    if (settings.label == '') {
      iconClass += ' ' + prefix + '_no-text';
    }

    if (settings.parentTag == 'a') {
      settings.parentTag = 'a href="#"';
    }

    // create menu bar
    $this.mobileNav.attr('class', prefix + '_nav');
    var menuBar = $('<div class="' + prefix + '_menu"></div>');
    $this.btn = $('<' + settings.parentTag + ' aria-haspopup="true" tabindex="0" class="' + prefix + '_btn ' + prefix + '_collapsed"><span class="' + prefix + '_menutxt">' + settings.label + '</span><span class="' + iconClass + '"><span class="' + prefix + '_icon-bar"></span><span class="' + prefix + '_icon-bar"></span><span class="' + prefix + '_icon-bar"></span></span></a>');
    $(menuBar).append($this.btn);
    $(settings.prependTo).prepend(menuBar);
    menuBar.append($this.mobileNav);

    // iterate over structure adding additional structure
    var items = $this.mobileNav.find('li');
    $(items).each(function () {
      var item = $(this);
      var data = {};
      data.children = item.children('ul').attr('role', 'menu');
      item.data("menu", data);

      // if a list item has a nested menu
      if (data.children.length > 0) {

        // select all text before the child menu
        var a = item.contents();
        var nodes = [];
        $(a).each(function () {
          if (!$(this).is("ul")) {
            nodes.push(this);
          }
          else {
            return false;
          }
        });

        // wrap item text with tag and add classes
        var wrap = $(nodes).wrapAll('<' + settings.parentTag + ' role="menuitem" aria-haspopup="true" tabindex="-1" class="' + prefix + '_item"/>').parent();

        item.addClass(prefix + '_collapsed');
        item.addClass(prefix + '_parent');

        // create parent arrow
        $(nodes).last().after('<span class="' + prefix + '_arrow">' + settings.closedSymbol + '</span>');


      }
      else {
        if (item.children().length == 0) {
          item.addClass(prefix + '_txtnode');
        }
      }

      // accessibility for links
      item.children('a').attr('role', 'menuitem').click(function () {
        //Emulate menu close if set
        if (settings.closeOnClick) {
          $($this.btn).click();
        }
      });
    });

    // structure is in place, now hide appropriate items
    $(items).each(function () {
      var data = $(this).data("menu");
      $this._visibilityToggle(data.children, false, null, true);
    });

    // finally toggle entire menu
    $this._visibilityToggle($this.mobileNav, false, 'init', true);

    // accessibility for menu button
    $this.mobileNav.attr('role', 'menu');

    // outline prevention when using mouse
    $(document).mousedown(function () {
      $this._outlines(false);
    });

    $(document).keyup(function () {
      $this._outlines(true);
    });

    // menu button click
    $($this.btn).click(function (e) {
      e.preventDefault();
      $this._menuToggle();
    });

    // click on menu parent
    $this.mobileNav.on('click', '.' + prefix + '_item', function (e) {
      e.preventDefault();
      $this._itemClick($(this));
    });

    // check for enter key on menu button and menu parents
    $($this.btn).keydown(function (e) {
      var ev = e || event;
      if (ev.keyCode == 13) {
        e.preventDefault();
        $this._menuToggle();
      }
    });

    $this.mobileNav.on('keydown', '.' + prefix + '_item', function (e) {
      var ev = e || event;
      if (ev.keyCode == 13) {
        e.preventDefault();
        $this._itemClick($(e.target));
      }
    });

    // allow links clickable within parent tags if set
    if (settings.allowParentLinks) {
      $('.' + prefix + '_item a').click(function (e) {
        e.stopImmediatePropagation();
      });
    }
  };

  //toggle menu
  Plugin.prototype._menuToggle = function (el) {
    var $this = this;
    var btn = $this.btn;
    var mobileNav = $this.mobileNav;

    if (btn.hasClass(prefix + '_collapsed')) {
      btn.removeClass(prefix + '_collapsed');
      btn.addClass(prefix + '_open');
    }
    else {
      btn.removeClass(prefix + '_open');
      btn.addClass(prefix + '_collapsed');
    }
    btn.addClass(prefix + '_animating');
    $this._visibilityToggle(mobileNav, true, btn);
  };

  // toggle clicked items
  Plugin.prototype._itemClick = function (el) {
    var $this = this;
    var settings = $this.settings;
    var data = el.data("menu");
    if (!data) {
      data = {};
      data.arrow = el.children('.' + prefix + '_arrow');
      data.ul = el.next('ul');
      data.parent = el.parent();
      el.data("menu", data);
    }
    if (data.parent.hasClass(prefix + '_collapsed')) {
      data.arrow.html(settings.openedSymbol);
      data.parent.removeClass(prefix + '_collapsed');
      data.parent.addClass(prefix + '_open');
      data.parent.addClass(prefix + '_animating');
      $this._visibilityToggle(data.ul, true, el);
    }
    else {
      data.arrow.html(settings.closedSymbol);
      data.parent.addClass(prefix + '_collapsed');
      data.parent.removeClass(prefix + '_open');
      data.parent.addClass(prefix + '_animating');
      $this._visibilityToggle(data.ul, true, el);
    }
  };

  // toggle actual visibility and accessibility tags
  Plugin.prototype._visibilityToggle = function (el, animate, trigger, init) {
    var $this = this;
    var settings = $this.settings;
    var items = $this._getActionItems(el);
    var duration = 0;
    if (animate) {
      duration = settings.duration;
    }

    if (el.hasClass(prefix + '_hidden')) {
      el.removeClass(prefix + '_hidden');
      el.slideDown(duration, settings.easingOpen, function () {

        $(trigger).removeClass(prefix + '_animating');
        $(trigger).parent().removeClass(prefix + '_animating');

        //Fire open callback
        if (!init) {
          settings.open(trigger);
        }
      });
      el.attr('aria-hidden', 'false');
      items.attr('tabindex', '0');
      $this._setVisAttr(el, false);
    }
    else {
      el.addClass(prefix + '_hidden');
      el.slideUp(duration, this.settings.easingClose, function () {
        el.attr('aria-hidden', 'true');
        items.attr('tabindex', '-1');
        $this._setVisAttr(el, true);
        el.hide(); //jQuery 1.7 bug fix

        $(trigger).removeClass(prefix + '_animating');
        $(trigger).parent().removeClass(prefix + '_animating');

        //Fire init or close callback
        if (!init) {
          settings.close(trigger);
        }
        else {
          if (trigger == 'init') {
            settings.init();
          }
        }
      });
    }
  };

  // set attributes of element and children based on visibility
  Plugin.prototype._setVisAttr = function (el, hidden) {
    var $this = this;

    // select all parents that aren't hidden
    var nonHidden = el.children('li').children('ul').not('.' + prefix + '_hidden');

    // iterate over all items setting appropriate tags
    if (!hidden) {
      nonHidden.each(function () {
        var ul = $(this);
        ul.attr('aria-hidden', 'false');
        var items = $this._getActionItems(ul);
        items.attr('tabindex', '0');
        $this._setVisAttr(ul, hidden);
      });
    }
    else {
      nonHidden.each(function () {
        var ul = $(this);
        ul.attr('aria-hidden', 'true');
        var items = $this._getActionItems(ul);
        items.attr('tabindex', '-1');
        $this._setVisAttr(ul, hidden);
      });
    }
  };

  // get all 1st level items that are clickable
  Plugin.prototype._getActionItems = function (el) {
    var data = el.data("menu");
    if (!data) {
      data = {};
      var items = el.children('li');
      var anchors = items.children('a');
      data.links = anchors.add(items.children('.' + prefix + '_item'));
      el.data("menu", data);
    }
    return data.links;
  };

  Plugin.prototype._outlines = function (state) {
    if (!state) {
      $('.' + prefix + '_item, .' + prefix + '_btn').css('outline', 'none');
    }
    else {
      $('.' + prefix + '_item, .' + prefix + '_btn').css('outline', '');
    }
  }

  Plugin.prototype.toggle = function () {
    $this._menuToggle();
  };

  Plugin.prototype.open = function () {
    $this = this;
    if ($this.btn.hasClass(prefix + '_collapsed')) {
      $this._menuToggle();
    }
  };

  Plugin.prototype.close = function () {
    $this = this;
    if ($this.btn.hasClass(prefix + '_open')) {
      $this._menuToggle();
    }
  };

  $.fn[mobileMenu] = function (options) {
    var args = arguments;

    // Is the first parameter an object (options), or was omitted, instantiate
    // a new instance
    if (options === undefined || typeof options === 'object') {
      return this.each(function () {

        // Only allow the plugin to be instantiated once due to methods
        if (!$.data(this, 'plugin_' + mobileMenu)) {

          // if it has no instance, create a new one, pass options to our
          // plugin constructor, and store the plugin instance in the elements
          // jQuery data object.
          $.data(this, 'plugin_' + mobileMenu, new Plugin(this, options));
        }
      });

      // If is a string and doesn't start with an underscore or 'init'
      // function, treat this as a call to a public method.
    }
    else {
      if (typeof options === 'string' && options[0] !== '_' && options !== 'init') {

        // Cache the method call to make it possible to return a value
        var returns;

        this.each(function () {
          var instance = $.data(this, 'plugin_' + mobileMenu);

          // Tests that there's already a plugin-instance and checks that the
          // requested public method exists
          if (instance instanceof Plugin && typeof instance[options] === 'function') {

            // Call the method of our plugin instance, and pass it the supplied
            // arguments.
            returns = instance[options].apply(instance, Array.prototype.slice.call(args, 1));
          }
        });

        // If the earlier cached method gives a value back return the value,
        // otherwise return this to preserve chainability.
        return returns !== undefined ? returns : this;
      }
    }
  };
}(jQuery, document, window));

(function ($) {

  Drupal.admin = Drupal.admin || {};
  Drupal.admin.behaviors = Drupal.admin.behaviors || {};

  // Create the responsive menu using SlickNav.
  Drupal.admin.behaviors.responsivemenu = function (context, settings, $adminMenu) {

    setTimeout(() => {
      $('#admin-menu-menu-responsive').slicknav({
        label: Drupal.t('Menu'),
        prependTo: 'body',
        closedSymbol: "<i class=\"closed\"></i>",
        openedSymbol: "<i class=\"open\"></i>",
        allowParentLinks: true
      });
    }, 1000)
  };

  // Create the responsive shortcuts dropdown.
  Drupal.admin.behaviors.responsiveshortcuts = function (context, settings, $adminMenu) {

    // Check if there are any shortucts to respondify.
    if (jQuery("div.toolbar-shortcuts ul.menu li").length) {

      // Create the dropdown base
      $('<select id="responsive-shortcuts-dropdown"/>').appendTo("#admin-menu-shortcuts-responsive div.toolbar-shortcuts");

      // Create default option "Select"
      $("<option />", {
        "selected": "selected",
        "class": "hide",
        "value": "",
        "text": Drupal.t('Shortcuts')
      }).appendTo("#admin-menu-shortcuts-responsive div.toolbar-shortcuts select");

      // Populate dropdown with menu items
      $("#admin-menu-shortcuts-responsive div.toolbar-shortcuts a").each(function () {
        var el = $(this);
        $("<option />", {
          "value": el.attr("href"),
          "text": el.text()
        }).appendTo("#admin-menu-shortcuts-responsive div.toolbar-shortcuts select");
      });

      // Redirect the user when selecting an option.
      $("#admin-menu-shortcuts-responsive div.toolbar-shortcuts select").change(function () {
        window.location = $(this).find("option:selected").val();
      });

      // Clean the mess.
      $('#admin-menu-shortcuts-responsive div.toolbar-shortcuts ul').remove();
      // Move the select box into the responsive menu.
      $("#admin-menu-shortcuts-responsive").prependTo(".slicknav_menu");

    }

    // Remove the edit shortcuts link from the DOM to avoid duble rendering.
    $('#admin-menu-shortcuts-responsive #edit-shortcuts').remove();

  };
})(jQuery);
;
(function ($) {

  Drupal.admin = Drupal.admin || {};
  Drupal.admin.behaviors = Drupal.admin.behaviors || {};

  /**
   * @ingroup admin_behaviors
   * @{
   */

  /**
   * Apply active trail highlighting based on current path.
   *
   * @todo Not limited to toolbar; move into core?
   */
  Drupal.admin.behaviors.toolbarActiveTrail = function (context, settings, $adminMenu) {
    if (settings.admin_menu.toolbar && settings.admin_menu.toolbar.activeTrail) {
      $adminMenu.find('> div > ul > li > a[href="' + settings.admin_menu.toolbar.activeTrail + '"]').addClass('active-trail');
    }
  };

  Drupal.admin.behaviors.shorcutcollapsed = function (context, settings, $adminMenu) {

    // Create the dropdown base
    $('<li class="label"><a>' + Drupal.t('Shortcuts') + '</a></li>').prependTo("body.menu-render-collapsed #toolbar div.toolbar-shortcuts ul");

  };

  Drupal.admin.behaviors.shorcutselect = function (context, settings, $adminMenu) {

    // Create the dropdown base
    $('<select id="shortcut-menu"/>').appendTo("body.menu-render-dropdown #toolbar div.toolbar-shortcuts");

    // Create default option "Select"
    $("<option />", {
      "selected": "selected",
      "value": "",
      "text": Drupal.t('Shortcuts')
    }).appendTo("body.menu-render-dropdown #toolbar div.toolbar-shortcuts select");

    // Populate dropdown with menu items
    $("body.menu-render-dropdown #toolbar div.toolbar-shortcuts a").each(function () {
      var el = $(this);
      $("<option />", {
        "value": el.attr("href"),
        "text": el.text()
      }).appendTo("body.menu-render-dropdown #toolbar div.toolbar-shortcuts select");
    });

    $("body.menu-render-dropdown #toolbar div.toolbar-shortcuts select").change(function () {
      window.location = $(this).find("option:selected").val();
    });

    $('body.menu-render-dropdown #toolbar div.toolbar-shortcuts ul').remove();

  };

  // Ovveride front link if changed by another module for the mobile menu.
  Drupal.admin.behaviors.mobile_front_link = function (context, settings, $adminMenu) {
    $("ul.slicknav_nav li.admin-menu-toolbar-home-menu a>a").attr("href", $("#admin-menu-icon > li > a").attr('href'));
  };

})(jQuery);
;
