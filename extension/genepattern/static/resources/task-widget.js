/**
 * Define the IPython GenePattern Task widget
 *
 * @author Thorin Tabor
 * @requires - jQuery, navigation.js
 *
 * Copyright 2015 The Broad Institute, Inc.
 *
 * SOFTWARE COPYRIGHT NOTICE
 * This software and its documentation are the copyright of the Broad Institute, Inc. All rights are reserved.
 * This software is supplied without any warranty or guaranteed support whatsoever. The Broad Institute is not
 * responsible for its use, misuse, or functionality.
 */

define("genepattern/task", ["base/js/namespace",
                            "nbextensions/jupyter-js-widgets/extension",
                            "genepattern/navigation",
                            "genepattern/job",
                            "jqueryui"], function (Jupyter, widgets, GPNotebook) {

    $.widget("gp.type_ahead", {
        options: {
            placeholder: "Add GenePattern File or URL...",
            width: "400px",
            data: [],
            click: function(widget) {},
            blur: function(widget) {}
        },

        _create: function() {
            var widget = this;

            this.element
                .addClass("gp-widget-typeahead")
                .css("width", this.options.width)
                .data("widget", this)
                .append(
                    $("<div></div>")
                        .addClass("form-group has-feedback gp-widget-typeahead-group")
                        .append(
                            $("<input/>")
                                .addClass("form-control gp-widget-typeahead-input")
                                .attr("placeholder", this.options.placeholder)
                                .attr("autocomplete", "off")
                                .click(this._click)
                                .blur(this._blur)
                        )
                        .append(
                            $("<span></span>")
                                .addClass("fa fa-caret-down form-control-feedback gp-widget-typeahead-arrow")
                        )
                        .append(
                            $("<ul></ul>")
                                .addClass("dropdown-menu gp-widget-typeahead-list")
                                .attr("tabindex", 0) // Marks as control element, so that the blur event works correctly
                        )
                );
        },
        _destroy: function() {},
        _setOptions: function(options) {},
        _setOption: function(key, value) {},

        _click: function(event) {
            var typeahead_input = $(event.target);
            var widget = typeahead_input.closest(".gp-widget-typeahead").data("widget");
            var menu = widget.element.find(".gp-widget-typeahead-list");

            // Make the click callback if one is defined
            if (widget.options.click) {
                widget.options.click(widget);
            }

            // Show the menu
            menu.show();
        },

        _blur: function(event) {
            const typeahead_input = $(event.target);
            const typeahead = typeahead_input.closest(".gp-widget-typeahead");
            const menu = typeahead.find(".gp-widget-typeahead-list");

            // Don't go any of this if they clicked on the menu's scrollbar
            if (menu.length && event.relatedTarget === menu[0]) {
                typeahead_input.focus();
                return;
            }

            // Hide the menu
            const widget = typeahead_input.closest(".gp-widget-typeahead").data("widget");
            menu.hide();

            // Make the blur callback if one is defined
            if (widget.options.blur) {
                widget.options.blur(widget);
            }
        },

        _update_menu: function(menu, kind, choices={}) {
            // Clear the menu
            menu.empty();

            // Get the latest output file data
            let output_files = GPNotebook.slider.output_files_by_kind(kind);

            // Handle the special case of no matching output files
            if (output_files.length === 0 && Object.keys(choices).length === 0) {
                menu.append(this._create_menu_header("No Matching GenePattern Files"));
                return;
            }

            // Structure the data by job
            output_files = this._files_by_job(output_files);

            // Add files to the menu
            for (let job in output_files) {
                menu.append(this._create_menu_header(job));
                const job_files = output_files[job];
                for (let i in job_files) {
                    menu.append(this._create_menu_file(job_files[i]));
                }
            }

            // Add the dynamic choices to the menu, if available
            if (Object.keys(choices).length > 0) {
                menu.append(this._create_menu_header("FTP Server Files", "ftp"));
                for (let key in choices) {
                    const choice = {
                        name: key,
                        url: choices[key]
                    };
                    menu.append(this._create_menu_file(choice, "ftp"));
                }
            }
        },

        /**
         * Create a file listing to add to the typeahead menu
         *
         * @param file
         * @param type
         * @returns {*|jQuery}
         * @private
         */
        _create_menu_file: function(file, type="job") {
            const widget = this;
            let type_class = "";
            if (type === "job") type_class = "gp-widget-typeahead-job-file";
            if (type === "ftp") type_class = "gp-widget-typeahead-ftp-file";

            return $("<li></li>")
                .append(
                    $("<a></a>")
                        .addClass("dropdown-file")
                        .addClass(type_class)
                        .attr("href", "#")
                        .attr("tabindex", 0) // Marks as control element, so that the blur event works correctly
                        .attr("data-value", file.url)
                        .text(file.name)
                        .mousedown(function() {
                            const typeahead_input = widget.element.find(".gp-widget-typeahead-input");
                            const val = $(this).attr("data-value");
                            $(typeahead_input).val(val);

                            // Hide the menu, if necessary
                            typeahead_input.focus();
                        })
                );
        },

        /**
         * Create a header in the typeahead menu.
         *
         * @param text
         * @param type - job or ftp
         * @returns {*|jQuery}
         * @private
         */
        _create_menu_header: function(text, type="job") {
            let type_class = "";
            if (type === "job") type_class = "gp-widget-typeahead-job-header";
            if (type === "ftp") type_class = "gp-widget-typeahead-ftp-header";

           return $("<li></li>")
               .addClass("dropdown-header")
               .addClass(type_class)
               .text(text);
        },

        _files_by_job: function(output_files) {
            var by_job = {};

            for (var i in output_files) {
                var file = output_files[i];

                if (!(file.job in by_job)) {
                    by_job[file.job] = [];

                }

                by_job[file.job].push(file);
            }

            return by_job;
        }
    });

    /**
     * Widget for file input into a GenePattern Notebook.
     * Used for file inputs by the runTask widget.
     *
     * Supported Features:
     *      External URLs
     *      Uploading New Files
     *      Pasted Internal File Paths
     *      Pasted Job Result URLs
     *
     * Non-Supported Features:
     *      GenomeSpace Files
     *      Browsing GenePattern Uploaded Files
     */
    $.widget("gp.fileInput", {
        options: {
            allowFilePaths: true,
            allowExternalUrls: true,
            allowJobUploads: true,

            // Pointers to associated runTask widget
            runTask: null,
            param: null
        },

        /**
         * Constructor
         *
         * @private
         */
        _create: function() {
            // Save pointers to associated Run Task widget or parameter
            this._setPointers();

            // Set variables
            var widget = this;
            this._values = null;
            this._displays = null;

            // Add data pointer
            this.element.data("widget", this);

            // Add classes and child elements
            this.element.addClass("file-widget");
            this.element.append(
                $("<div></div>")
                    .addClass("file-widget-upload")
                    .append(
                        $("<button></button>")
                            .addClass("btn btn-default file-widget-upload-file")
                            .text("Upload File...")
                            .click(function () {
                                $(this).parents(".file-widget").find(".file-widget-input-file").click();
                            })
                    )
                    .append(
                        $("<input />")
                            .addClass("file-widget-input-file")
                            .attr("type", "file")
                            .change(function () {
                                var files = widget.element.find(".file-widget-input-file")[0].files;
                                var list = [];
                                for (var i = 0; i < files.length; i++) {
                                    list.push(files[i]);
                                }

                                // Throw an error if this would overflow max values
                                if (!widget._valNumGood(list)) {
                                    widget._runTask.errorMessage(widget._param.name() + " cannot handle that many values. Max values: " + widget._param.maxValues());
                                    return;
                                }

                                widget.addValues(list);
                            })
                    )
                    .append(
                        $("<div></div>").type_ahead({
                            placeholder: "Add GenePattern File or URL...",
                            data: [],
                            click: function(twidget) {
                                const menu = twidget.element.find(".gp-widget-typeahead-list");
                                let kinds = widget.kinds();         // Get list of kinds this param accepts
                                if (!kinds) kinds = "*";            // If none are defined, accepts everything

                                // Get the list of dynamic dropdown choices, if available
                                let choices = null;
                                if (widget.options.param) choices = widget.options.param.choices();
                                if (!choices) choices = {};

                                // Update the menu
                                twidget._update_menu(menu, kinds, choices);
                            },
                            blur: function(twidget) {
                                var typeahead_input = twidget.element.find(".gp-widget-typeahead-input");
                                var typeahead_value = typeahead_input.val();

                                // Clear the input
                                twidget.element.find(".gp-widget-typeahead-input").val("");

                                // Disregard if the value is blank
                                if (typeahead_value.trim() === "") {
                                    return;
                                }

                                // Throw an error if this would overflow max values
                                if (!widget._valNumGood(typeahead_value)) {
                                    widget._runTask.errorMessage(widget._param.name() + " cannot handle that many values. Max values: " + widget._param.maxValues());
                                    return;
                                }

                                // Update the values
                                widget.addValues(typeahead_value);
                                widget._updateCode();
                            }
                        })
                    )
                    .append(
                        $("<span></span>")
                            .addClass("file-widget-drop")
                            .text("Drag Files Here")
                    )
            );
            this.element.append(
                $("<div></div>")
                    .addClass("file-widget-listing")
                    .css("display", "none")
            );
            this.element.append(
                $("<div></div>")
                    .addClass("file-widget-warning alert alert-warning")
                    .append("File may not be an acceptable format. This input expects ")
                    .append(this._kindsListString() + ".")
                    .hide()
            );

            // Initialize the drag & drop functionality
            if (this.options.allowJobUploads) {
                this._initDragDrop();
            }

            // Hide elements if not in use by options
            this._setDisplayOptions();
        },

        /**
         * Destructor
         *
         * @private
         */
        _destroy: function() {
            this.element.removeClass("file-widget");
            this.element.empty();
        },

        _kindsListString: function() {
            var kinds = this._param.kinds();
            if (!kinds) return "anything";
            else return kinds.join(", ");
        },

        /**
         * Initializes the drag & drop functionality in the widget
         *
         * @private
         */
        _initDragDrop: function() {
            var widget = this;
            var dropTarget = this.element[0];

            dropTarget.addEventListener("dragenter", function(event) {
                widget.element.css("background-color", "#dfeffc");
                event.stopPropagation();
                event.preventDefault();
            }, false);
            dropTarget.addEventListener("dragexit", function(event) {
                widget.element.css("background-color", "");
                event.stopPropagation();
                event.preventDefault();
            }, false);
            dropTarget.addEventListener("dragover", function(event) {
                event.stopPropagation();
                event.preventDefault();
            }, false);
            dropTarget.addEventListener("drop", function(event) {
                // If there is are files assume this is a file drop
                if (event['dataTransfer'].files.length > 0) {
                    var files = event['dataTransfer'].files;
                    var list = [];
                    for (var i = 0; i < files.length; i++) {
                        list.push(files[i]);
                    }

                    // Throw an error if this would overflow max values
                    if (!widget._valNumGood(list)) {
                        widget._runTask.errorMessage(widget._param.name() + " cannot handle that many values. Max values: " + widget._param.maxValues());

                        widget.element.css("background-color", "");
                        event.stopPropagation();
                        event.preventDefault();
                        return;
                    }

                    widget.addValues(list);
                }
                // If not, assume this is a text drop
                else {
                    var html = event['dataTransfer'].getData('text/html');
                    var htmlList = $(html);

                    // Path for Firefox
                    if (htmlList.length === 1) {
                        var tag = $(htmlList).prop("tagName");
                        if (tag.toLowerCase() !== "a") {
                            htmlList = $(htmlList).find("a");
                        }
                        var text = $(htmlList).attr("href");
                        if (text !== undefined && text !== null) {

                            // Throw an error if this would overflow max values
                            if (!widget._valNumGood(text)) {
                                widget._runTask.errorMessage(widget._param.name() + " cannot handle that many values. Max values: " + widget._param.maxValues());

                                widget.element.css("background-color", "");
                                event.stopPropagation();
                                event.preventDefault();
                                return;
                            }

                            widget.addValues(text);
                            widget._updateCode();
                        }
                    }

                    // Path for Chrome
                    else if (htmlList.length > 1) {
                        $.each(htmlList, function(i, e) {
                            var text = $(e).attr("href");
                            if (text !== undefined && text !== null) {

                                // Throw an error if this would overflow max values
                                if (!widget._valNumGood(text)) {
                                    widget._runTask.errorMessage(widget._param.name() + " cannot handle that many values. Max values: " + widget._param.maxValues());

                                    widget.element.css("background-color", "");
                                    event.stopPropagation();
                                    event.preventDefault();
                                    return;
                                }

                                widget.addValues(text);
                                widget._updateCode();
                            }
                        });
                    }

                    // Path for Safari
                    else if (html === "") {
                        text = event['dataTransfer'].getData('text/uri-list');
                        if (text !== undefined && text !== null) {

                                // Throw an error if this would overflow max values
                                if (!widget._valNumGood(text)) {
                                    widget._runTask.errorMessage(widget._param.name() + " cannot handle that many values. Max values: " + widget._param.maxValues());

                                    widget.element.css("background-color", "");
                                    event.stopPropagation();
                                    event.preventDefault();
                                    return;
                                }

                                widget.addValues(text);
                                widget._updateCode();
                            }
                    }
                }

                widget.element.css("background-color", "");

                event.stopPropagation();
                event.preventDefault();
            }, false);
        },

        /**
         * Ensures that new values won't violate max value constraints.
         * Return true if it's all good, false otherwise.
         *
         * @param newVals
         * @returns {boolean}
         * @private
         */
        _valNumGood: function(newVals) {
            // Ensure newVals is a list
            if (newVals.constructor !== Array) {
                newVals = [newVals];
            }

            var maxVals = this._param.maxValues();
            var currentVals = this._values ? this._values.length : 0;
            var addVals = newVals.length;

            // Handle case of unlimited max
            if (maxVals === -1) return true;

            return currentVals + addVals <= maxVals;
        },

        /**
         * Creates or destroys the box of selected files
         *
         * @param files - A string if to show, undefined or null if to hide
         * @private
         */
        _fileBox: function(files) {
            if (files) {
                var widget = this;
                $.each(files, function (i, e) {
                    widget.element.find(".file-widget-listing").append(widget._createFileBox(e));
                });
                this.element.find(".file-widget-listing").show();

                // Display type warning, if necessary
                this._setTypeWarning(files);

                // Hide upload stuff if at max
                var maxVals = this._param.maxValues();
                var currentVals = this._values ? this._values.length : 0;
                if (maxVals === currentVals) {
                    this.element.find(".file-widget-upload").hide();
                }
            }
            else {
                this.element.find(".file-widget-upload").show();
                this.element.find(".file-widget-listing").hide();
                this.element.find(".file-widget-listing").empty();
                this._hideTypeWarning();
            }
        },

        /**
         * Displays or hides the file type warning message, as appropriate
         *
         * @param files
         * @private
         */
        _setTypeWarning: function(files) {
            // Transform File objects to strings
            var displays = this._valuesToDisplay(files);

            if (this._needTypeWarning(displays)) { this._displayTypeWarning(); }
            else { this._hideTypeWarning(); }
        },

        /**
         * Determines if the file type doesn't match the expected input type
         *
         * @param files
         * @private
         */
        _needTypeWarning: function(files) {
            var foundWarning = false;
            var accepts = this._param.kinds();

            // Special case for empty kind lists
            if (!accepts) return false;

            for (var i in files) {
                var file = files[i];
                var match = false;

                for (var j in accepts) {
                    var kind = accepts[j];
                    if (file.endsWith(kind)) {
                        match = true;
                    }

                    // Special case for ODF files
                    if (file.toLowerCase().endsWith("odf") && kind.length > 5) {
                        match = true;
                    }
                }

                if (!match) foundWarning = true;
            }

            return foundWarning;
        },

        /**
         * Displays a warning message that the file type doesn't match the expected input type
         *
         * @private
         */
        _displayTypeWarning: function() {
            this.element.find(".file-widget-warning").show();
        },

        /**
         * Hides the warning message that the file type doesn't match the expected input type
         *
         * @private
         */
        _hideTypeWarning: function() {
            this.element.find(".file-widget-warning").hide();
        },

        /**
         * Creates a file box element for the selected file value
         *
         * @param file
         * @returns {jQuery} - the jQuery wrapped file box element
         * @private
         */
        _createFileBox: function(file) {
            var widget = this;
            return $("<div></div>")
                .addClass("file-widget-value")
                .attr("name", file)
                .append(
                    $("<div></div>")
                        .addClass("btn btn-default btn-sm file-widget-value-erase")
                        .append(
                            $("<span></span>")
                                .addClass("fa fa-times")
                        )
                        .click(function() {
                            widget._removeValue(file);
                            widget.element.find(".file-widget-value[name='" + file + "']").remove();
                            widget.element.find(".file-widget-upload").show();
                            widget._setTypeWarning(widget._values);
                            widget._updateCode();
                        })
                )
                .append(
                    $("<span></span>")
                        .addClass("file-widget-value-text")
                        .text(file)
                );
        },

        /**
         * Takes a set of values and returns the display strings for the values
         *
         * @param values - the list of values
         * @returns {Array} - the display value list
         * @private
         */
         _valuesToDisplay: function(values) {
            var displays = [];
            var that = this;
            $.each(values, function(index, val) {
                var aDisplay = that._singleDisplay(val);
                displays.push(aDisplay);
            });
            return displays;
        },

        /**
         * Turns a single value for the file into a display value
         *
         * @param value - the value, either a string or File object
         * @returns {string}
         * @private
         */
        _singleDisplay: function(value) {
            if (typeof value === 'string') {
                return value;
            }
            else {
                return value.name;
            }
        },

        /**
         * Removes the specified display value from the values list
         *
         * @param value
         * @private
         */
        _removeValue: function(value) {
            var widget = this;

            // Handle special case of Python variables
            if (VariableManager.getVariableList(value).length > 0) {
                // Assume the first value matches the variable and remove it
                widget._values.splice(0, 1);
                return;
            }

            $.each(this._values, function(i, e) {
                var display = widget._singleDisplay(e);
                if (display === value) {
                    widget._values.splice(i, 1);
                    return false;
                }
            });

            // Cannot find exact value to remove, could have uploaded the file
            // This changes the value from the file name to the uploaded URL
            // Try removing the matching URL
            $.each(this._values, function(i, e) {
                var parser = document.createElement('a');
                parser.href = widget.options.runTask.options.session.server();

                var display = widget._singleDisplay(e);
                var foundHost = display.indexOf(parser.host) === 7 || display.indexOf(parser.host) === 8;

                if (foundHost && display.endsWith(value)) {
                    widget._values.splice(i, 1);
                    return false;
                }
            });
        },

        /**
         * Replace the indicated display value with the new value
         *
         * @param value
         * @param replacement
         * @private
         */
        _replaceValue: function(value, replacement) {
            var widget = this;
            $.each(this._values, function(i, e) {
                var display = widget._singleDisplay(e);
                if (display === value) {
                    widget._values[i] = replacement;
                    return false;
                }
            });
        },

        /**
         * Update the pointers to the Run Task widget and parameter
         *
         * @private
         */
        _setPointers: function() {
            if (this.options.runTask) { this._runTask = this.options.runTask; }
            if (this.options.param) { this._param = this.options.param; }

            // Add data pointer
            this.element.data("widget", this);
        },

        /**
         * Update the display of the UI to match current options
         *
         * @private
         */
        _setDisplayOptions: function() {
            if (!this.options.allowJobUploads) {
                this.element.find(".file-widget-upload-file").hide();
                this.element.find(".file-widget-drop").hide();
            }
            else {
                this.element.find(".file-widget-upload-file").show();
                this.element.find(".file-widget-drop").show();
            }
        },

        /**
         * Update all options
         *
         * @param options - Object contain options to update
         * @private
         */
        _setOptions: function(options) {
            this._superApply(arguments);
            this._setPointers();
            this._setDisplayOptions();
        },

        /**
         * Update individual option
         *
         * @param key - The name of the option
         * @param value - The new value of the option
         * @private
         */
        _setOption: function(key, value) {
            this._super(key, value);
            this._setPointers();
            this._setDisplayOptions();
        },

        /**
         * Upload the specified file file to the server. If this file widget
         * holds a list with multiple files awaiting upload, this function
         * will need to be called repeatedly for all files awaiting upload.
         *
         * @param pObj - Object containing the following params:
         *                  file: the file to upload
         *                  success: Callback for success, expects url to file
         *                  error: Callback on error, expects exception
         * @returns {object} - Returns a reference to the file which was just
         *      uploaded, returns null if no file upload was initiated
         */
        upload: function(pObj) {
            var file = pObj.file;
            var currentlyUploading = null;
            var widget = this;

            // Value is a File object
            if (typeof file === 'object' && file) {
                widget.options.runTask.options.session.upload({
                    file: file,
                    success: function(response, url) {
                        // Mark the file as uploaded
                        var display = widget._singleDisplay(file);
                        widget._replaceValue(display, url);
                        widget._updateCode();

                        if (pObj.success) {
                            pObj.success(response, url);
                        }
                    },
                    error: function(exception) {
                        console.log("Error uploading file from file input widget: " + exception.statusText);
                        if (pObj.error) {
                            pObj.error(exception);
                        }
                    }
                });
                currentlyUploading = file;
            }
            // If the value is not set, give an error
            else if (!file) {
                console.log("Cannot upload from file input: value is null.");
                if (pObj.error) {
                    pObj.error({statusText: "Cannot upload from file input: value is null."});
                }
            }
            // If the value is a string, do nothing
            else {
                // Else assume we have a non-upload value selected
            }

            return currentlyUploading;
        },

        /**
         * Updates the Run Task Widget code to include the new value
         *
         * @private
         */
        _updateCode: function() {
            this._runTask.updateCode(this._param.name(), this._values);
        },

        /**
         * Getter for associated RunTask object
         *
         * @returns {object|null}
         */
        runTask: function() {
            return this._runTask;
        },

        /**
         * Getter for associated parameter
         * @returns {string|null|object}
         */
        param: function() {
            return this._param;
        },

        /**
         * Returns the list of kinds accepted by the file input
         *
         * @returns {Array|null}
         */
        kinds: function() {
            return this.options.param.kinds();
        },

        /**
         * This is just a clone of values() for compatibility with other widgets
         *
         * @param val
         * @returns {object|string|null}
         */
        value: function(val) {
            return this.values(val);
        },

        /**
         * Gets or sets the values of this widget
         *
         * @param [val=optional] - String value for file (undefined is getter)
         * @returns {object|string|null} - The value of this widget
         */
        values: function(val) {
            // Do setter
            if (val) {
                // Handle wrapping lists
                if (val.constructor !== Array) {
                    val = [val];
                }

                this._values = val;
                this._displays = this._valuesToDisplay(val);
                this._fileBox(null);
                this._fileBox(this._displays);
            }
            // Do getter
            else {
                return this._values;
            }
        },

        /**
         * Adds the indicated values to the existing value array
         *
         * @param val
         */
        addValues: function(val) {
            // Handle wrapping lists
            if (val.constructor !== Array) {
                val = [val];
            }

            // Handle null or undefined value array
            if (this._values === undefined || this._values === null) {
                this._values = [];
            }

            // Handle null or undefined display array
            if (this._displays === undefined || this._displays === null) {
                this._displays = [];
            }

            // Display list
            var displayList = this._valuesToDisplay(val);

            this._values = this._values.concat(val);
            this._displays = this._displays.concat(displayList);
            this._fileBox(displayList);
        },

        /**
         * Clears the current value of the widget and hides file box
         * @private
         */
        clear: function() {
            this._values = null;
            this._fileBox(null);
        }
    });


    /**
     * Widget for text input into a GenePattern Notebook.
     * Used for text, number and password inputs by the runTask widget.
     *
     * Supported Features:
     *      Text input
     *      Password input
     *      Number input
     *
     * Non-Supported Features:
     *      Directory input
     */
    $.widget("gp.textInput", {
        options: {
            type: "text", // Accepts: text, number, password
            default: "",

            // Pointers to associated runTask widget
            runTask: null,
            param: null
        },

        /**
         * Constructor
         *
         * @private
         */
        _create: function() {
            // Save pointers to associated Run Task widget or parameter
            this._setPointers();

            // Set variables
            var widget = this;
            //noinspection JSValidateTypes
            this._value = this.options.default;

            // Clean the type option
            this._cleanType();

            // Add data pointer
            this.element.data("widget", this);

            // Add classes and child elements
            this.element.addClass("text-widget");
            this.element.append(
                $("<input />")
                    .addClass("form-control text-widget-input")
                    .attr("type", this.options.type)
                    .val(this._value)
                    .change(function() {
                        widget._value = $(this).val();
                        widget._updateCode();
                    })
            );

            // Hide elements if not in use by options
            this._setDisplayOptions();
        },

        /**
         * Destructor
         *
         * @private
         */
        _destroy: function() {
            this.element.removeClass("text-widget");
            this.element.empty();
        },

        /**
         * Update all options
         *
         * @param options - Object contain options to update
         * @private
         */
        _setOptions: function(options) {
            this._superApply(arguments);
            this._setPointers();
            this._setDisplayOptions();
        },

        /**
         * Update for single options
         *
         * @param key - The name of the option
         * @param value - The new value of the option
         * @private
         */
        _setOption: function(key, value) {
            this._super(key, value);
            this._setPointers();
            this._setDisplayOptions();
        },

        /**
         * Update the pointers to the Run Task widget and parameter
         *
         * @private
         */
        _setPointers: function() {
            if (this.options.runTask) { this._runTask = this.options.runTask; }
            if (this.options.param) { this._param = this.options.param; }
        },

        /**
         * Update the display of the UI to match current options
         *
         * @private
         */
        _setDisplayOptions: function() {
            this._cleanType();
            this.element.find(".text-widget-input").prop("type", this.options.type);
        },

        /**
         * Removes bad type listings, defaulting to text
         *
         * @private
         */
        _cleanType: function() {
            if (typeof this.options.type !== 'string') {
                console.log("Type option for text input is not a string, defaulting to text");
                this.options.type = "text";
            }
            if (this.options.type.toLowerCase() !== "text" &&
                this.options.type.toLowerCase() !== "password" &&
                this.options.type.toLowerCase() !== "number") {
                console.log("Type option for text input is not 'text', 'password' or 'number', defaulting to text");
                this.options.type = "text";
            }
        },

        /**
         * Updates the Run Task Widget code to include the new value
         *
         * @private
         */
        _updateCode: function() {
            this._runTask.updateCode(this._param.name(), this._value);
        },

        /**
         * Gets or sets the value of the input
         *
         * @param val - the value for the setter
         * @returns {_value|string}
         */
        value: function(val) {
            // Do setter
            if (val) {
                this._value = val;
                this.element.find(".text-widget-input").val(val);
            }
            // Do getter
            else {
                return this._value;
            }
        }
    });


    /**
     * Widget for choice input into a GenePattern Notebook.
     * Used for choice inputs by the runTask widget.
     *
     * Supported Features:
     *      Simple Choice Input
     *
     * Non-Supported Features:
     *      File choice input
     *      Dynamic choice parameters
     */
    $.widget("gp.choiceInput", {
        options: {
            choices: [], // Assumes an object of key, value pairs
            default: null,

            // Pointers to associated runTask widget
            runTask: null,
            param: null
        },

        /**
         * Constructor
         *
         * @private
         */
        _create: function() {
            // Save pointers to associated Run Task widget or parameter
            this._setPointers();

            // Set variables
            var widget = this;

            // Add data pointer
            this.element.data("widget", this);

            // Add classes and child elements
            this.element.addClass("choice-widget");
            this.element.append(
                $("<select></select>")
                    .addClass("form-control choice-widget-select")
                    .change(function() {
                        // Special case for a custom value
                        var selected = $(this).find("option:selected");
                        if (selected.text() == "Custom Value (developer)") {
                            widget.customValueDialog(selected);
                            return;
                        }

                        // The general case
                        widget._value = $(this).val();
                        widget._updateCode();
                    })
            );

            // Hide elements if not in use by options
            this._setDisplayOptions();
        },

        /**
         * Destructor
         *
         * @private
         */
        _destroy: function() {
            this.element.removeClass("choice-widget");
            this.element.empty();
        },

        /**
         * Update all options
         *
         * @param options - Object contain options to update
         * @private
         */
        _setOptions: function(options) {
            this._superApply(arguments);
            this._setPointers();
            this._setDisplayOptions();
        },

        /**
         * Update for single options
         *
         * @param key - The name of the option
         * @param value - The new value of the option
         * @private
         */
        _setOption: function(key, value) {
            this._super(key, value);
            this._setPointers();
            this._setDisplayOptions();
        },

        /**
         * Update the pointers to the Run Task widget and parameter
         *
         * @private
         */
        _setPointers: function() {
            if (this.options.runTask) { this._runTask = this.options.runTask; }
            if (this.options.param) { this._param = this.options.param; }
        },

        /**
         * Update the display of the UI to match current options
         *
         * @private
         */
        _setDisplayOptions: function() {
            this._applyChoices();
            this._applyDefault();
        },

        /**
         * Applies the choices options, setting them to the provided values
         *
         * @private
         */
        _applyChoices: function() {
            if (typeof this.options.choices !== 'object') {
                console.log("Error reading choices in Choice Input, aborting");
                return;
            }

            var select = this.element.find(".choice-widget-select");
            select.empty();

            for (var key in this.options.choices) {
                if (this.options.choices.hasOwnProperty(key)) {
                    var value = this.options.choices[key];

                    select.append(
                        $("<option></option>")
                            .text(key)
                            .val(value)
                    );
                }
            }

            // Add the custom value option
            select.append(
                $("<option></option>")
                    .text("Custom Value (developer)")
                    .val("")
            );
        },

        /**
         * Applies the option for default, resetting the selected option
         *
         * @private
         */
        _applyDefault: function() {
            this.element.find(".choice-widget-select").val(this.options.default);
            this._value = this.element.find(".choice-widget-select").val();
        },

        /**
         * Updates the Run Task Widget code to include the new value
         *
         * @private
         */
        _updateCode: function() {
            this._runTask.updateCode(this._param.name(), this._value);
        },

        /**
         * Prompts the user for a custom value, sets the value on the dropdown
         *
         * @param option - the option element in the dropdown
         */
        customValueDialog: function(option) {
            var dialog = require('base/js/dialog');

            // Get Current Custom Value
            var currentValue = $(option).val();

            dialog.modal({
                notebook: Jupyter.notebook,
                keyboard_manager: this.keyboard_manager,
                title : "Custom Parameter Value",
                body : $("<div></div>")
                    .append($("<div></div>")
                        .addClass("alert alert-warning")
                        .append("Setting a custom value for a choice parameter is considered an " +
                            "advanced developer feature. If you don't know what you're doing, this " +
                            "will likely result in an error after the job is launched.")
                    )
                    .append($("<div></div>")
                            .addClass("form-group")
                            .append($("<label>")
                                .attr("for", "gp-task-custom-value")
                                .css("font-weight", "bold")
                                .text("Enter Custom Value")
                            )
                            .append(
                                $("<input>")
                                    .attr("type", "text")
                                    .attr("name", "gp-task-custom-value")
                                    .attr("placeholder", "Enter Value")
                                    .addClass("form-control")
                                    .val(currentValue)
                                    .keydown(function(event) {
                                        event.stopPropagation();
                                    })
                            )
                    ),
                buttons : {
                    "Cancel" : {
                        "click": function() {
                        }
                    },
                    "Set Value" : {
                        "class" : "btn-warning",
                        "click" : function() {
                            var customValue = $(".modal-dialog").find("[name=gp-task-custom-value]").val();
                            $(option).val(customValue);
                            var widget = $(option).closest(".choice-widget").data("widget");
                            widget.value(customValue);
                            widget._updateCode();
                        }
                    }
                }
            });
        },

        /**
         * Gets or sets the value of the input
         *
         * @param val - the value for the setter
         * @returns {_value|string}
         */
        value: function(val) {
            // Do setter
            if (val) {
                this._value = val;
                this.element.find(".choice-widget-select").val(val);
            }
            // Do getter
            else {
                return this._value;
            }
        }
    });


    /**
     * Widget for entering parameters and launching a job from a task.
     *
     * Supported Features:
     *      File Inputs
     *      Text Inputs
     *      Choice Inputs
     *      EULA support
     *      Reloaded Jobs
     *      File Lists
     *
     * Non-Supported Features:
     *      Batch Parameters
     *      Dynamic Dropdowns
     */
    $.widget("gp.runTask", {
        // Flags for whether events have been called on the widget
        _widgetRendered: false,
        _paramsLoaded: false,

        options: {
            lsid: null,
            name: null,
            task: null,
            session: null,
            session_index: null,
            cell: null
        },

        /**
         * Constructor
         *
         * @private
         */
        _create: function() {
            // Set variables
            var widget = this;
            var identifier = this._getIdentifier();

            // Add data pointer
            this.element.data("widget", this);

            // Attach the session, if necessary and possible
            if (!this.options.session && this.options.cell) {
                this.options.session_index = this._session_index_from_code();
                this.options.session = this._session_from_index(this.options.session_index);
            }

            // By default assume the module is installed
            this._installed = true;

            // By default the list of accepted kinds is null
            this._kinds = null;

            // Add classes and scaffolding
            this.element.addClass("panel panel-default gp-widget gp-widget-task");
            this.element.append( // Attach header
                $("<div></div>")
                    .addClass("panel-heading gp-widget-task-header")
                    .append(
                        $("<div></div>")
                            .addClass("widget-float-right")
                            .append(
                                $("<span></span>")
                                    .addClass("gp-widget-task-version")
                            )
                            .append(
                                $("<button></button>")
                                    .addClass("btn btn-default btn-sm widget-slide-indicator")
                                    .css("padding", "2px 7px")
                                    .attr("title", "Expand or Collapse")
                                    .attr("data-toggle", "tooltip")
                                    .attr("data-placement", "bottom")
                                    .append(
                                        $("<span></span>")
                                            .addClass("fa fa-minus")
                                    )
                                    .tooltip()
                                    .click(function() {
                                        widget.expandCollapse();
                                    })
                            )
                            .append(" ")
                            .append(
                                $("<div></div>")
                                    .addClass("btn-group")
                                    .append(
                                        $("<button></button>")
                                            .addClass("btn btn-default btn-sm")
                                            .css("padding", "2px 7px")
                                            .attr("type", "button")
                                            .attr("data-toggle", "dropdown")
                                            .attr("aria-haspopup", "true")
                                            .attr("aria-expanded", "false")
                                            .append(
                                                $("<span></span>")
                                                    .addClass("fa fa-cog")
                                            )
                                            .append(" ")
                                            .append(
                                                $("<span></span>")
                                                    .addClass("caret")
                                            )
                                    )
                                    .append(
                                        $("<ul></ul>")
                                            .addClass("dropdown-menu gear-menu")
                                            .append(
                                                $("<li></li>")
                                                    .append(
                                                        $("<a></a>")
                                                            .addClass("gp-widget-task-doc")
                                                            .attr("title", "Documentation")
                                                            .attr("href", "#")
                                                            .append("Documentation")
                                                            .click(function() {
                                                                var url = $(event.target).attr("data-href");
                                                                window.open(url,'_blank');
                                                            })
                                                    )
                                            )
                                            .append(
                                                $("<li></li>")
                                                    .append(
                                                        $("<a></a>")
                                                            .attr("title", "Toggle Code View")
                                                            .attr("href", "#")
                                                            .append("Toggle Code View")
                                                            .click(function() {
                                                                widget.toggleCode();
                                                            })
                                                    )
                                            )
                                    )
                            )
                    )
                    .append(
                        $("<img/>")
                            .addClass("gp-widget-logo")
                            .attr("src", Jupyter.notebook.base_url + "nbextensions/genepattern/resources/" + "GP_logo_on_black.png")
                    )
                    .append(
                        $("<h3></h3>")
                            .addClass("panel-title")
                            .append(
                                $("<span></span>")
                                    .addClass("gp-widget-task-name")
                            )
                    )
            );
            this.element.append( // Attach header
                $("<div></div>")
                    .addClass("panel-body")
                    .css("position", "relative")
                    .append(
                        $("<div></div>")
                            .addClass("widget-code gp-widget-task-code")
                            .css("display", "none")
                    )
                    .append( // Attach message box
                        $("<div></div>")
                            .addClass("alert gp-widget-task-message")
                            .css("display", "none")
                    )
                    .append( // Attach subheader
                        $("<div></div>")
                            .addClass("gp-widget-task-subheader")
                            .append(
                                $("<div></div>")
                                    .addClass("gp-widget-task-desc")
                            )
                            .append(
                                $("<div></div>")
                                    .addClass("gp-widget-task-run")
                                    .append(
                                        $("<button></button>")
                                            .addClass("btn btn-primary gp-widget-task-run-button")
                                            .text("Run")
                                            .click(function() {
                                                if (widget.validate()) {
                                                    widget.submit();
                                                }
                                            })
                                    )
                                    .append("* Required Field")
                            )
                    )
                    .append(
                        $("<div></div>") // Attach form placeholder
                            .addClass("form-horizontal gp-widget-task-form")
                    )
                    .append( // Attach footer
                        $("<div></div>")
                            .addClass("gp-widget-task-footer")
                            .append(
                                $("<div></div>")
                                    .addClass("gp-widget-task-run")
                                    .append(
                                        $("<button></button>")
                                            .addClass("btn btn-primary gp-widget-task-run-button")
                                            .text("Run")
                                            .click(function() {
                                                if (widget.validate()) {
                                                    widget.submit();
                                                }
                                            })
                                    )
                                    .append("* Required Field")
                            )
                    )
                    .append(
                        $("<div></div>")
                            .addClass("gp-widget-logged-in gp-widget-task-eula")
                            .append(
                                $("<div></div>")
                                    .addClass("gp-widget-loading")
                                    .append(
                                        $("<img />")
                                            .attr("src", Jupyter.notebook.base_url + "nbextensions/genepattern/resources/" + "loader.gif")
                                    )
                                    .hide()
                            )
                            .append(
                                $("<div></div>")
                                    .text("You must agree to the following End-User license agreements before you can run this task.")
                            )
                            .append(
                                $("<div></div>")
                                    .addClass("gp-widget-task-eula-box")
                            )
                            .append(
                                $("<div></div>")
                                    .text("Do you accept the license agreements?")
                            )
                            .append(
                                $("<div></div>")
                                    .append(
                                        $("<button></button>")
                                            .addClass("btn btn-warning btn-lg gp-widget-task-eula-accept")
                                            .text("Accept")
                                            .click(function() {
                                                var success = function() {
                                                    widget.element.find(".gp-widget-task-eula").hide();
                                                };
                                                var error = function(xhr, error) {
                                                    widget.errorMessage(error);
                                                };

                                                widget.getTask(function(task) {
                                                    if (task === null) {
                                                        console.log("Error getting task for EULA acceptance");
                                                        return;
                                                    }
                                                    task.acceptEula(success, error);
                                                });
                                            })
                                    )
                            )
                            .hide()
                    )
            );

            // Apply server color scheme if authenticated
            if (widget.options.session !== null && widget.options.session.authenticated) {
                GPNotebook.slider.applyColors(widget.element, widget.options.session.server());
            }

            // Check to see if the user is authenticated yet
            if (widget.options.session && widget.options.session.authenticated) {
                // Make call to build the header & form
                this.getTask(function(task) {
                    if (task !== null) {
                        widget._buildHeader();
                        widget._buildForm();
                    }
                    else {
                        widget._showUninstalledMessage();
                    }
                });
            }
            else {
                this._showAuthenticationMessage();
                this._pollForAuth();
            }

            // Trigger gp.widgetRendered event on cell element
            setTimeout(function() {
                widget._widgetRendered = true;
                widget.element.closest(".cell").trigger("gp.widgetRendered");
            }, 10);

            return this;
        },

        /**
         * Destructor
         *
         * @private
         */
        _destroy: function() {
            this.element.removeClass("gp-widget-task");
            this.element.empty();
        },

        /**
         * Update all options
         *
         * @param options - Object contain options to update
         * @private
         */
        _setOptions: function(options) {
            this._superApply(arguments);
            var widget = this;
            var identifier = this._getIdentifier();

            this.getTask(function(task) {
                if (task !== null) {
                    widget._buildHeader();
                    widget._buildForm();
                }
                else {
                    widget._showUninstalledMessage();
                }
            });
        },

        /**
         * Update for single options
         *
         * @param key - The name of the option
         * @param value - The new value of the option
         * @private
         */
        _setOption: function(key, value) {
            this._super(key, value);
        },

        /**
         * Retrieves the associated Task object from cache, or from the server if necessary
         *
         * @param done - Function to call once the task is loaded
         *      Passes the Task() object in as a parameter, or null if in error
         *
         * @returns {GenePattern.Task|null} - Returns null if task had to be retrieved
         *      from the server, otherwise returns the Task() object
         */
        getTask: function(done) {
            // First check for the associated task, return if found
            var task = this.options.task;
            if (task !== null) {
                done(task);
                return task;
            }

            // Otherwise check the general GenePattern cache
            var identifier = this._getIdentifier();
            task = this.options.session.task(identifier);
            if (task !== null) {
                this.options.task = task; // Associate this task with the widget
                done(task);
                return task;
            }

            // Otherwise call back to the server
            var widget = this;
            this.options.session.taskQuery({
                lsid: identifier,
                success: function(newTask) {
                    widget.options.task = newTask; // Associate this task with the widget
                    done(newTask);
                },
                error: function(error) {
                    console.log(error);
                    done(null);
                }
            });
            return null;
        },

        /**
         * Returns the associated job widget for output
         *
         * This selects the next JobWidget with a matching task, located in
         * the notebook after this task widget, but before the next task widget.
         *
         * If no such widget can be found, returns null.
         */
        getJobWidget: function() {
            var all_cells = Jupyter.notebook.get_cells();
            var this_cell = this.element.closest(".cell").data("cell");
            var this_cell_found = false;
            var output_cell = null;

            // Iterate over all cells
            for (var i in all_cells) {
                var cell = all_cells[i];

                // Break loop if the next task cell is found
                var is_task_cell = cell.element.find(".gp-widget-task").length > 0;
                if (this_cell_found && is_task_cell) break;

                // Locate the current task cell
                if (cell.cell_id === this_cell.cell_id) {
                    this_cell_found = true;
                    continue;
                }

                // Locate the next matching job cell
                var is_job_cell = cell.element.find(".gp-widget-job").length > 0;
                if (this_cell_found && is_job_cell) {
                    var task_lsid = this.options.task.lsid();
                    var job_widget = cell.element.find(".gp-widget-job").data("widget");
                    var job_ref = job_widget.options.job;

                    // If the job object is null, this is a purged job, assume it matches
                    if (job_ref === null) {
                        output_cell = cell;
                        break;
                    }

                    var job_task = job_ref.task();
                    var job_lsid = job_task.lsid();
                    if (job_lsid === task_lsid) {
                        output_cell = cell;
                        break;
                    }
                }
            }

            return output_cell;
        },

        /**
         * Expand or collapse the task widget
         *
         *     expand - optional parameter used to force an expand or collapse,
         *         leave undefined to toggle back and forth
         */
        expandCollapse: function(expand) {
            var toSlide = this.element.find(".panel-body:first");
            var indicator = this.element.find(".widget-slide-indicator").find("span");
            var isHidden = toSlide.is(":hidden");

            if (isHidden || expand) {
                toSlide.slideDown();
                indicator.removeClass("fa-plus");
                indicator.addClass("fa-minus");
            }
            else if (expand === false || !isHidden) {
                toSlide.slideUp();
                indicator.removeClass("fa-minus");
                indicator.addClass("fa-plus");
            }
        },

        /**
         * Returns an identifier for attaining the Task object from the server
         *
         * @returns {string|null}
         * @private
         */
        _getIdentifier: function() {
            if (this.options.lsid) { return this.options.lsid; }
            else if (this.options.name) { return this.options.name }
            else {
                throw "Error creating Run Task widget! No LSID or name!";
            }
        },

        _session_index_from_code: function() {
            // Make sure that this is a task cell
            if ('genepattern' in this.options.cell.metadata && this.options.cell.metadata.genepattern.type !== "task") {
                console.log("Attempting to extract session index from non-task cell");
                return 0;
            }

            var code = this.options.cell.get_text();
            var index = 0;
            try {
                index = Number.parseInt(code.split("genepattern.get_session(")[1].split(")")[0]);
            }
            catch (e) {
                console.log("Cannot extract GenePattern session index, defaulting to 0");
            }
            return index;
        },

        _session_from_index: function(index) {
            return GPNotebook.session_manager.get_session(index);
        },

        /**
         * Display module not installed message
         *
         * @private
         */
        _showUninstalledMessage: function() {
            // Mark the module as not installed
            this._installed = false;

            // Show the message
            this.element.find(".gp-widget-task-name").empty().text("Module Not Installed");
            this.errorMessage("This module is not installed on this GenePattern server.");
            this.element.find(".gp-widget-task-subheader").hide();
            this.element.find(".gp-widget-task-footer").hide();
        },

        /**
         * Display the not authenticated message
         *
         * @private
         */
        _showAuthenticationMessage: function() {
            this.element.find(".gp-widget-task-name").empty().text("Not Authenticated");
            this.element.find(".gp-widget-task-form").empty()
                .addClass("alert alert-danger")
                .text("You must be authenticated before the task information can be displayed. After you authenticate it may take a few seconds for the task information to appear.");
            this.element.find(".gp-widget-task-subheader").hide();
            this.element.find(".gp-widget-task-footer").hide();

            // Update the doc button
            this.element.find(".gp-widget-task-doc").attr("disabled", "disabled");
        },

        /**
         * Polls every few seconds to see if the notebook is authenticated, and gets task info once authenticated
         *
         * @private
         */
        _pollForAuth: function() {
            var widget = this;
            setTimeout(function() {
                // Try to grab the session again
                widget.options.session = widget._session_from_index(widget.options.session_index);

                // Check to see if the user is authenticated yet
                if (widget.options.session && widget.options.session.authenticated) {
                    // If authenticated, execute cell again
                    var cellElement = widget.element.closest(".cell");
                    if (cellElement.length > 0) {
                        var cellObject = cellElement.data("cell");
                        if (cellObject) {
                            cellObject.execute();
                        }
                    }
                }
                else {
                    // If not authenticated, poll again
                    widget._pollForAuth();
                }
            }, 1000);
        },

        /**
         * Build the EULA pane and display if necessary
         *
         * @private
         */
        _buildEula: function() {
            var widget = this;
            this.getTask(function(task) {
                // Handle error
                if (task === null) {
                    console.log("Task error in _buildEula()");
                    return
                }

                var eula = task.eula();   // Get the EULAs
                // Only build the EULA display if necessary
                if (eula !== undefined && eula !== null && eula['pendingEulas'] !== undefined && eula['pendingEulas'].length > 0) {
                    var box = widget.element.find(".gp-widget-task-eula-box");

                    // Attach each of the EULAs
                    for (var i = 0; i < eula['pendingEulas'].length; i++) {
                        var license = eula['pendingEulas'][i];
                        var licenseBox = $("<pre></pre>")
                            .addClass("gp-widget-task-eula-license")
                            .text(license['content']);
                        box.append(licenseBox);
                    }

                    widget.element.find(".gp-widget-task-eula").show();
                }
            });
        },

        /**
         * Build the header and return the Task object
         *
         * @private
         */
        _buildHeader: function() {
            var widget = this;
            this.getTask(function(task) {
                // Handle error
                if (task === null) {
                    console.log("Task error in _buildEula()");
                    return
                }

                widget.element.find(".gp-widget-task-subheader").show();
                widget.element.find(".gp-widget-task-footer").show();

                widget.element.find(".gp-widget-task-name").empty().text(" " + task.name());
                widget.element.find(".gp-widget-task-version").empty().text("Version " + task.version());
                widget.element.find(".gp-widget-task-doc").attr("data-href", widget.options.session.server() + task.documentation().substring(3));
                widget.element.find(".gp-widget-task-desc").empty().text(task.description());

                // Display error if Java visualizer
                var categories = task.categories();
                if (categories.indexOf("Visualizer") !== -1) {
                    widget.errorMessage("This job appears to be a deprecated Java-based visualizer. These visualizers are not supported in the GenePattern Notebook.");
                }
            });
        },

        /**
         * Parse the code for the job spec and return the values of the inputs in a dictionary
         *
         * @private
         */
        _parseJobSpec: function() {
            var dict = {};
            var code = this.options.cell.code_mirror.getValue();
            var lines = code.split("\n");

            for (var i = 0; i < lines.length; i++) {
                var line = lines[i];

                // Here is a line to parse
                if (line.indexOf(".set_parameter") !== -1) {
                    var key = this._parseKeyFromLine(line);
                    var value = this._parseValueFromLine(line);
                    dict[key] = value;
                }
            }

            return dict;
        },

        /**
         * Given a line of code with job_spec.set_parameter, parse and return the value
         *
         * @param line
         * @returns {object}
         * @private
         */
        _parseValueFromLine: function(line) {
            // Pull the text out of the parentheses
            var pullFromParen = /\(([^)]+)\)/;
            var match = line.match(pullFromParen);
            var insideParen = match && match[1];

            // If it couldn't find the correct text, abort
            if (insideParen === null) {
                console.log("Couldn't find parameters in: " + line);
                return null;
            }

            // Pull out the value substring
            var commaIndex = insideParen.indexOf(",");
            var valueStr = insideParen.substring(commaIndex+1).trim();

            // Determine whether this represents a list or not
            var firstChar = valueStr.charAt(0);
            var isList = firstChar === "[";

            // If not, trim the quotes and return the unescaped string
            if (!isList) {
                var withoutQuotes = valueStr.substring(1, valueStr.length-1);
                return this._unescapeQuotes(withoutQuotes);
            }

            // If this is a list, parse into constituent strings
            if (isList) {
                try {
                    var valueList = eval(valueStr);
                    return valueList;
                }
                catch (e) {
                    console.log("Error parsing list from: " + valueStr);
                    return null;
                }
            }
        },

        /**
         * Given a line of code with job_spec.set_parameter, parse and return the key
         *
         * @param line
         * @returns {string}
         * @private
         */
        _parseKeyFromLine: function(line) {
            var parts = line.split(",");
            var first = parts[0].split("\"");
            return first[1];
        },

        _buildParamGroupHeader: function(group) {
            return $("<div></div>")
                .addClass("gp-widget-task-group")
                .css("margin-bottom", "10px")
                .append(
                    $("<div></div>")
                        .addClass("panel-heading gp-widget-task-group-title")
                        .css("display", group.name ? "block" : "none")
                        .text(group.name)
                        .append(
                            $("<div></div>")
                                .addClass("widget-float-right")
                                .append(
                                    $("<button></button>")
                                        .addClass("btn btn-default btn-sm widget-slide-indicator")
                                        .attr("title", "Expand or Collapse")
                                        .attr("data-toggle", "tooltip")
                                        .attr("data-placement", "bottom")
                                        .css("padding", "2px 7px")
                                        .append(
                                            $("<span></span>")
                                                .addClass(group.hidden ? "fa fa-plus" : "fa fa-minus")
                                        )
                                        .click(function() {
                                            var toSlide = $(this).closest(".gp-widget-task-group").find(".gp-widget-task-group-params");
                                            var indicator = $(this).find("span");
                                            var isHidden = toSlide.is(":hidden");

                                            if (isHidden) {
                                                toSlide.slideDown();
                                                indicator.removeClass("fa-plus");
                                                indicator.addClass("fa-minus");
                                            }
                                            else if (!isHidden) {
                                                toSlide.slideUp();
                                                indicator.removeClass("fa-minus");
                                                indicator.addClass("fa-plus");
                                            }
                                        })
                                )
                        )
                )
                .append(
                    $("<div></div>")
                        .addClass("gp-widget-task-group-params")
                        .css("display", group.hidden ? "none" : "block")
                        .append(
                            $("<div></div>")
                                .addClass("panel-body gp-widget-task-group-description")
                                .css("display", group.description ? "block" : "none")
                                .text(group.description)
                        )
                )

        },

        _addParamGroup: function(group, allParams, reloadVals) {
            function getParam(name) {
                for (var i = 0; i < allParams.length; i++) {
                    if (allParams[i].name() === name) return allParams[i];
                }
                throw "no matching param name found: " + name;
            }

            // Handle groups without any parameters
            if (!group.parameters) return;

            // Add the parameter header
            var form = this.element.find(".gp-widget-task-form");
            var groupDiv = this._buildParamGroupHeader(group);
            form.append(groupDiv);

            // Add widgets for all parameters in the group
            for (var i = 0; i < group.parameters.length; i++) {
                try {
                    // Get the Param object
                    var param = null;
                    if (typeof group.parameters[i] !== "string") {
                        param = group.parameters[i];
                    }
                    else {
                        param = getParam(group.parameters[i]);
                    }

                    // Add the parameter widget
                    var pDiv = this._addParam(param, groupDiv.find(".gp-widget-task-group-params"));

                    if (reloadVals[param.name()] !== undefined) {
                        var pWidget = pDiv.data("widget");
                        pWidget.value(reloadVals[param.name()]);
                    }
                }
                catch(exception) {
                    console.log(exception);
                }
            }
        },

        /**
         * Make the call to the server to get the params and build the form
         *
         * @private
         */
        _buildForm: function() {
            var widget = this;
            this.getTask(function(task) {
                // Handle error
                if (task === null) {
                    console.log("Task error in _buildEula()");
                    return
                }

                widget.element.find(".gp-widget-task-form").empty();

                task.params({
                    success: function(response, params) {
                        var reloadVals = widget._parseJobSpec();

                        // Iterate over parameter groups
                        // TODO: Implement
                        if (task.paramGroups()) {
                            // Iterate over groups and add params
                            var groups = task.paramGroups();
                            for (var i = 0; i < groups.length; i++) {
                                widget._addParamGroup(groups[i], params, reloadVals);
                            }
                        }
                        else {
                            // Assume one blank group if not defined
                            widget._addParamGroup({
                                name: "",
                                description: "",
                                parameters: params
                            }, params, reloadVals);
                        }

                        // Build the accepted kinds list
                        widget._createKindsList(params);

                        // Build the EULA, too
                        widget._buildEula();

                        // Build the job_spec if necessary
                        if (Object.keys(reloadVals).length === 0) {
                            widget._addJobSpec(params);
                        }
                        widget._paramsLoaded = true;
                        $(widget.element).trigger("runTask.paramLoad");
                    },
                    error: function(exception) {
                        widget.errorMessage("Could not load task: " + exception.statusText);
                    }
                });
            });
        },

        /**
         * Escape the quotes in a string so it can be safely included in code generation
         *
         * @param srcString
         * @returns {string}
         * @private
         */
        _escapeQuotes: function(srcString) {
            return (srcString + '').replace(/[\\"']/g, '\\$&').replace(/\u0000/g, '\\0');
        },

        /**
         * Unescape quotes in a string so an escaped value can be retrieved from code
         *
         * @param srcString
         * @returns {string}
         * @private
         */
        _unescapeQuotes: function(srcString) {
            return (srcString + '').replace(/\\/g, "");
        },

        /**
         * Adds parameters to job_spec in the code for the widget
         *
         * @param params
         * @private
         */
        _addJobSpec: function(params) {
            var code = this.options.cell.code_mirror.getValue();
            var lines = code.split("\n");
            var jobSpecName = null;
            var insertAfter = null;

            // Get the job_spec name and _task name
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i];
                var parts = null;

                // Obtain the variable name of the job_spec
                if (line.indexOf("_job_spec = ") !== -1) {
                    parts = line.split(" ");
                    jobSpecName = parts[0];
                    insertAfter = i;
                    continue;
                }
            }

            // If job_spec name is still null, return
            if (jobSpecName === null) {
                console.log("Error setting job_spec params, no job_spec name found");
                return;
            }

            // Generate the .set_parameter code
            var newLines = [];
            for (var i = 0; i < params.length; i++) {
                var param = params[i];
                var newLine = jobSpecName + '.set_parameter("' + param.name() + '", "' + this._escapeQuotes(param.defaultValue()) + '")';
                newLines.unshift(newLine);
            }

            // Insert the generated code
            $.each(newLines, function(i, line) {
                lines.splice(insertAfter+1, 0, line);
            });

            // Set the new code
            code = lines.join("\n");
            this.options.cell.code_mirror.setValue(code);

            return code;
        },

        /**
         * Updates the parameter value in the code's job_spec
         *
         * @param paramName
         * @param value
         */
        updateCode: function(paramName, value) {
            var code = this.options.cell.code_mirror.getValue();
            var lines = code.split("\n");
            var jobSpecName = null;
            var codeToLookFor = '.set_parameter("' + paramName + '"';
            var lineToSwap = null;

            // Get the job_spec name
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i];

                // Obtain the variable name of the job_spec
                if (line.indexOf("_job_spec = ") !== -1) {
                    var parts = line.split(" ");
                    jobSpecName = parts[0];
                    break;
                }
            }

            // If job_spec name is still null, return
            if (jobSpecName === null) {
                console.log("Error setting job_spec params, no job_spec name found");
                return;
            }

            // Find correct line to replace
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i];

                // Found the line!
                if (line.indexOf(codeToLookFor) !== -1) {
                    lineToSwap = i;
                }
            }

            // If the line wasn't found, error and return
            if (lineToSwap === null) {
                console.log("Could not find code line to update: " + paramName);
                return;
            }

            // Convert values to a string for inclusion
            var valueString = null;
            if (value.constructor === Array && value.length > 1) {
                var escapedStrings = [];
                valueString = '[';
                for (var i = 0; i < value.length; i++) {
                    var aValue = value[i];
                    escapedStrings.push('"' + this._escapeQuotes(aValue) + '"');
                }
                valueString += escapedStrings.join(", ") + ']';
            }
            else {
                valueString = '"' + this._escapeQuotes(value) + '"';
            }

            // Generate new code line
            var newLine = jobSpecName + '.set_parameter("' + paramName + '", ' + valueString + ')';

            // Add new code to lines
            lines.splice(lineToSwap, 1, newLine);

            // Set the new code
            code = lines.join("\n");
            this.options.cell.code_mirror.setValue(code);

            return code;
        },

        /**
         * Toggle the code view on or off
         */
        toggleCode: function() {
            var widget = this;
            var code = this.element.find(".gp-widget-task-code");
            var form = this.element.find(".gp-widget-task-form");
            var headers = this.element.find(".gp-widget-task-subheader, .gp-widget-task-footer");
            var eula = this.element.find(".gp-widget-task-eula");
            var message = this.element.find(".gp-widget-task-message");

            if (code.is(":hidden")) {
                this.options.cell.code_mirror.refresh();
                var raw = this.element.closest(".cell").find(".input").html();
                code.html(raw);

                // Fix the issue where the code couldn't be selected
                code.find(".CodeMirror-scroll").attr("draggable", "false");

                // Fix the issue with the bogus scrollbars
                code.find(".CodeMirror-hscrollbar").remove();
                code.find(".CodeMirror-vscrollbar").remove();
                code.find(".CodeMirror-sizer").css("min-width", "").css("overflow", "auto");

                form.slideUp();
                headers.slideUp();
                eula.slideUp();
                message.slideUp();
                code.slideDown();
            }
            else {
                form.slideDown();

                // Only show message if there is one
                if (message.hasClass("alert-success") || message.hasClass("alert-danger")) {
                    message.slideDown();
                }


                if (widget.options.session) { // Protect against null
                    // Only show the EULA if there is one to display
                    var task = widget.options.session.task(widget.options.lsid);
                    if (task && task.eula() && task.eula().pendingEulas && task.eula().pendingEulas.length > 0) {
                        eula.slideDown();
                    }
                }

                // Only show these bits if authenticated and installed
                if (widget.options.session && widget.options.session.authenticated && this._installed) {
                    headers.slideDown();
                }

                code.slideUp();
            }

            var collapsed = this.element.find(".widget-slide-indicator").find(".fa-plus").length > 0;
            if (collapsed) {
                this.expandCollapse();
            }
        },

        /**
         * Add the parameter to the form and return the widget
         *
         * @param param {GenePattern.Param}
         * @private
         */
        _addParam: function(param, form) {
            var required = param.optional() ? "" : "*";

            var paramBox = $("<div></div>")
                .addClass(" form-group gp-widget-task-param")
                .attr("name", param.name())
                .attr("title", param.name())
                .append(
                    $("<label></label>")
                        .addClass("col-sm-3 control-label gp-widget-task-param-name")
                        .text(GPNotebook.util.display_name(param.name()) + required)
                )
                .append(
                    $("<div></div>")
                        .addClass("col-sm-9 gp-widget-task-param-wrapper")
                        .append(
                            $("<div></div>")
                                .addClass("gp-widget-task-param-input")
                        )
                        .append(
                            $("<div></div>")
                                .addClass("gp-widget-task-param-desc")
                                .text(param.description())
                        )
                );
            if (required) paramBox.addClass("gp-widget-task-required");

            // Add the correct input widget
            if (param.type() === "java.io.File") {
                paramBox.find(".gp-widget-task-param-input").fileInput({
                    runTask: this,
                    param: param
                });
            }
            else if (param.choices()) {
                paramBox.find(".gp-widget-task-param-input").choiceInput({
                    runTask: this,
                    param: param,
                    choices: param.choices(),
                    default: param.defaultValue()
                });
            }
            else if (param.type() === "java.lang.String") {
                paramBox.find(".gp-widget-task-param-input").textInput({
                    runTask: this,
                    param: param,
                    default: param.defaultValue()
                });
            }
            else if (param.type() === "java.lang.Integer" || param.type() === "java.lang.Float") {
                paramBox.find(".gp-widget-task-param-input").textInput({
                    runTask: this,
                    param: param,
                    default: param.defaultValue(),
                    type: "number"
                });
            }
            else {
                console.log("Unknown input type for Run Task widget: " + param.name() + " " + param.type());
                this.errorMessage("Type error in parameter " + param.name() + ", defaulting to text input.");

                paramBox.find(".gp-widget-task-param-input").textInput({
                    runTask: this,
                    param: param,
                    default: param.defaultValue()
                });
            }

            form.append(paramBox);
            return paramBox.find(".gp-widget-task-param-input");
        },

        /**
         * From the input widget's element get the input widget's value
         *
         * @param inputDiv - The element that has been made into the widget
         * @returns {*}
         * @private
         */
        _getInputValue: function(inputDiv) {
            if ($(inputDiv).hasClass("file-widget")) {
                return $(inputDiv).fileInput("value");
            }
            else if ($(inputDiv).hasClass("text-widget")) {
                return $(inputDiv).textInput("value");
            }
            else if ($(inputDiv).hasClass("choice-widget")) {
                return $(inputDiv).choiceInput("value");
            }
            else {
                console.log("Unknown input widget type.");
                return null;
            }
        },

        /**
         * Show a success message to the user
         *
         * @param message - String containing the message to show
         */
        successMessage: function(message) {
            var messageBox = this.element.find(".gp-widget-task-message");
            messageBox.removeClass("alert-danger");
            messageBox.addClass("alert-success");
            messageBox.text(message);
            messageBox.show("shake", {}, 500);
        },

        /**
         * Show an error message to the user
         *
         * @param message - String containing the message to show
         */
        errorMessage: function(message) {
            var messageBox = this.element.find(".gp-widget-task-message");
            messageBox.removeClass("alert-success");
            messageBox.addClass("alert-danger");
            messageBox.text(message);
            messageBox.show("shake", {}, 500);
        },

        /**
         * Validate the current Run Task form
         */
        validate: function() {
            var validated = true;
            var missing = [];
            var params = this.element.find(".gp-widget-task-param");

            // Validate each required parameter
            for (var i = 0; i < params.length; i++) {
                var param = $(params[i]);
                var required = param.hasClass("gp-widget-task-required");
                if (required) {
                    var input = param.find(".gp-widget-task-param-input");
                    var value = this._getInputValue(input);
                    if (value === null || value === "" || value.length === 0) {
                        param.addClass("gp-widget-task-param-missing");
                        missing.push(param.attr("name"));
                        validated = false;
                    }
                    else {
                        param.removeClass("gp-widget-task-param-missing");
                    }
                }
            }

            // Display message to user
            if (validated) {
                //this.successMessage("All required parameters present.");
            }
            else {
                this.errorMessage("Missing required parameters: " + missing.join(", "));
            }

            return validated;
        },

        /**
         * Creates the list of accepted kinds for the task
         *
         * @param params - List of gp.Param() objects
         * @private
         */
        _createKindsList: function(params) {
            var kindsSet = new Set();

            // Protect against null and undefined
            if (params === undefined || params === null) return [];

            $.each(params, function(index, param) {
                var kinds = param.kinds();
                if (kinds !== null && kinds !== undefined) {
                    kinds.forEach(function(kind) {
                        kindsSet.add(kind);
                    });
                }
            });

            // Transform Set() to Array() in way that is browser compatible
            var kindsArray = [];
            kindsSet.forEach(function(i) {
                kindsArray.push(i);
            });

            this._kinds = kindsArray;
        },

        /**
         * Returns a list of all Kinds accepted by the task. If the params for the task have not
         * been loaded yet, a null value will be returned.
         *
         * @returns {Array}
         */
        acceptedKinds: function() {
            return this._kinds;
        },

        /**
         * Receives a file of the specified kind and sets the first matching param of that type
         * Report an error to the console if no matching parameter found.
         *
         * @param url
         * @param kind
         */
        receiveFile: function(url, kind) {
            var uiParams = this.element.find(".gp-widget-task-param");
            var matched = false;
            $.each(uiParams, function(i, uiParam) {
                var paramWidget = $(uiParam).find(".gp-widget-task-param-input").data("widget");
                var param = paramWidget._param;
                if (param.kinds !== undefined) {
                    var kinds = param.kinds();
                    if (kinds !== undefined && kinds !== null) {
                        if (kinds.indexOf(kind) !== -1) {
                            // Found a match!
                            matched = true;
                            // Set the value
                            paramWidget.value(url);
                            // Update the code
                            paramWidget._updateCode();
                            // Return and stop looping
                            return false;
                        }
                    }
                }
            });

            // No match was found
            if (!matched) {
                var task = this.options.session.task(this.options.lsid);
                console.log("ERROR: No kind match found for " + url + " of kind " + kind + " in " + task.name());
            }
        },

        /**
         * Given the DOM node for a parameter, obtain and return the parameter's name
         * @param uiParam
         * @private
         */
        _getParamName: function(uiParam) {
            return $(uiParam).attr("name");
        },

        /**
         * Submit the Run Task form to the server
         */
        submit: function() {
            var widget = this;

            // Create the job input
            widget.getTask(function(task) {
                var jobInput = task.jobInput();

                widget.uploadAll({
                    success: function() {
                        widget.evaluateAllVars({
                            success: function() {
                                // Assign values from the inputs to the job input
                                var uiParams = widget.element.find(".gp-widget-task-param");
                                for (var i = 0; i < uiParams.length; i++) {
                                    var uiParam = $(uiParams[i]);
                                    var uiInput = uiParam.find(".gp-widget-task-param-input");
                                    var uiValue = widget._getInputValue(uiInput);
                                    var uiName = widget._getParamName(uiParam);

                                    if (uiValue !== null) {
                                        // Wrap value in list if not already wrapped
                                        if (uiValue.constructor !== Array) {
                                            uiValue = [uiValue];
                                        }

                                        const objParam = jobInput.param(uiName);
                                        objParam.values(uiValue);
                                    }
                                }

                                // Submit the job input
                                jobInput.submit({
                                    success: function(response, jobNumber) {
                                        //widget.successMessage("Job successfully submitted! Job ID: " + jobNumber);

                                        // Collapse the task widget
                                        widget.expandCollapse();

                                        // Find the associated job widget
                                        var cell = widget.getJobWidget();

                                        // Create a new cell for the job widget, if necessay
                                        if (!cell) cell = Jupyter.notebook.insert_cell_below();

                                        // Set the code for the job widget
                                        GPNotebook.slider.buildJobCode(cell, widget.options.session_index, jobNumber);

                                        // Execute cell.
                                        cell.execute();

                                        // Scroll to the top of the task cell
                                        $('#site').animate({
                                            scrollTop: $(Jupyter.notebook.get_selected_cell().element).position().top - 10
                                        }, 500);
                                        Jupyter.notebook.select(Jupyter.notebook.find_cell_index(cell));
                                    },
                                    error: function(exception) {
                                        widget.errorMessage("Error submitting job: " + exception.statusText);
                                    }
                                });
                            },
                            error: function(exception) {
                                widget.errorMessage("Error evaluating kernel variables in preparation of job submission: " + exception.statusText);
                            }
                        });
                    },
                    error: function(exception) {
                        widget.errorMessage("Error uploading in preparation of job submission: " + exception.statusText);
                    }
                });
            });
        },

        /**
         * Iterate through every input parameter and evaluate any kernel variables
         * found, then make a callback
         *
         * @param pObj - Object containing the following params:
         *                  success: Callback for success, expects no arguments
         *                  error: Callback on error, expects exception
         */
        evaluateAllVars: function(pObj) {
            var inputWidgets = this.element.find(".gp-widget-task-param-input");
            var evalCallsFinished = false;
            var evalsNeeded = 0;
            var evalsFinished = 0;

            // Iterate over each widget
            for (var i = 0; i < inputWidgets.length; i++) {
                var iWidget = $(inputWidgets[i]).data("widget");
                var value = iWidget.value();

                // Protect against nulls
                if (value === null || value === undefined) value = [];

                var makeCall = function(iWidget, value, valueIndex) {
                    VariableManager.evaluateVariables(value, function(evalValue) {
                        if (valueIndex === undefined) iWidget._value = evalValue;
                        else iWidget._values[valueIndex] = evalValue;

                        // Count this as an eval finished
                        evalsFinished++;

                        // Make the final callback once ready
                        if (evalCallsFinished && evalsFinished === evalsNeeded) pObj.success();
                    });
                };

                // If value is not a list, evaluate and set
                if (!Array.isArray(value)) {
                    // Count this as an eval needed
                    evalsNeeded++;

                    makeCall(iWidget, value);
                }
                // Otherwise, iterate over the list, evaluate and set
                else {
                    evalsNeeded += value.length;

                    for (var j = 0; j < value.length; j++) {
                        var valueIndex = j;
                        var innerValue = value[j];

                        makeCall(iWidget, innerValue, valueIndex);
                    }
                }
            }

            // All calls for evaluation have been made
            evalCallsFinished = true;

            // Check one last time to see if we need to make the final callback
            if (evalCallsFinished && evalsFinished === evalsNeeded) pObj.success();
        },

        /**
         * Upload all the file inputs that still need uploading
         *
         * @param pObj - Object containing the following params:
         *                  success: Callback for success, expects no arguments
         *                  error: Callback on error, expects exception
         * @returns {boolean} - Whether an upload was just initiated or not
         */
        uploadAll: function(pObj) {
            var fileWidgets = this.element.find(".file-widget");
            var widget = this;
            var uploadList = [];
            var error = false;

            // Create upload list
            for (var i = 0; i < fileWidgets.length; i++) {
                var fileWidget = $(fileWidgets[i]).data("widget");
                var values = fileWidget.values();

                // Protect against nulls
                if (values === null || values === undefined) values = [];

                $.each(values, function(i, e) {
                    if (typeof e === 'object') {
                        uploadList.push({
                            file: e,
                            widget: fileWidget
                        });
                    }
                });
            }

            // Declare finalizeUploads()
            var finalizeUploads = function() {
                if (error) {
                    pObj.error(error);
                }
                else {
                    pObj.success();
                }
            };

            // Declare grabNextUpload()
            var grabNextUpload = function() {
                // Pop the upload off the list
                var upload = uploadList.shift();

                // If it's not undefined, upload
                if (upload !== undefined) {
                    widget.successMessage("Uploading file " + upload.file.name);
                    upload.widget.upload({
                        file: upload.file,
                        success: function(response, url) {
                            // On the success callback call grabNextUpload()
                            grabNextUpload();
                        },
                        error: function(exception) {
                            // On the error callback set the error and call finalize
                            error = exception;
                            finalizeUploads();
                        }
                    });
                }

                // If it is undefined, call finalizeUploads()
                else {
                    finalizeUploads();
                }
            };

            // Start the uploads
            grabNextUpload();
        }
    });

    /**
     * Singleton for managing kernel variables and their evaluation
     *
     * @type {{cleanVariableText: VariableManager.cleanVariableText, getKernelValue: VariableManager.getKernelValue, getVariableList: VariableManager.getVariableList, replaceVariables: VariableManager.replaceVariables, evaluateList: VariableManager.evaluateList, evaluateVariables: VariableManager.evaluateVariables}}
     */
    var VariableManager = {

        /**
         * Remove surrounding single quotes from Python strings
         *
         * @param raw_text
         * @returns {*}
         */
        cleanVariableText: function(raw_text) {
            return raw_text.replace(/^\'|\'$/g, "");
        },

        /**
         * Call the kernel and get the value of a variable,
         * then make callback, passing in the value
         *
         * @param code
         * @param callback
         */
        getKernelValue: function(code, callback) {
            Jupyter.notebook.kernel.execute(
                code,
                {
                    iopub: {
                        output: function(response) {
                            // See if there is any output
                            if (response.content.data) {
                                var return_text = response.content.data["text/plain"];
                                return_text = VariableManager.cleanVariableText(return_text);
                                callback(return_text);
                            }
                            else {
                                // Return null if there was no output
                                callback(null);
                            }
                        }
                    }
                },
                { silent: false, store_history: false, stop_on_error: true }
            );
        },

        /**
         * Extract a list of kernel variables from the given string
         *
         * @param raw_value
         * @returns {*}
         */
        getVariableList: function(raw_value) {
            // Ensure that the value is a string
            const raw_string = typeof raw_value !== "string" ? raw_value.toString() : raw_value;

            // Handle the case of there being no variables
            if (!raw_string.includes("{{") || !raw_string.includes("}}")) return [];

            return raw_string
                .match(/{{\s*[\w\.]+\s*}}/g)
               .map(function(x) { return x.match(/[\w\.]+/)[0]; });
        },

        /**
         * Given a string with kernel variables and a map of variable/value pairs,
         * replace all variable instances with their values
         *
         * @param raw_string
         * @param replace_map
         * @returns {*}
         */
        replaceVariables: function(raw_string, replace_map) {
            function interpolate(str) {
                return function interpolate(o) {
                    return str.replace(/{{([^{}]*)}}/g, function (a, b) {
                        var r = o[b.trim()];
                        return typeof r === 'string' || typeof r === 'number' ? r : a;
                    });
                }
            }

            var terped = interpolate(raw_string)(replace_map);
            return terped;
        },

        /**
         * Given a list of variable names, look up the value of each and then make
         * a callback once the values of all are known
         *
         * @param var_list
         * @param final_callback
         */
        evaluateList: function(var_list, final_callback) {
            // Initialize the callback counter
            var callbacks_needed = var_list.length;
            var current_callbacks = 0;

            // Declare and populate map with undefined values
            var return_map = {};
            var_list.forEach(function(e) {
                return_map[e] = undefined;
                VariableManager.getKernelValue(e, function(value) {
                    return_map[e] = value; // Assign the evaluated value
                    current_callbacks++;   // Increment the callback counter

                    // Once ready, make the final callback
                    if (current_callbacks === callbacks_needed) {
                        final_callback(return_map);
                    }
                });
            });

            // Check one last time for the final callback
            if (current_callbacks === callbacks_needed) {
                final_callback(return_map);
            }
        },

        /**
         * Evaluate a string and replace all kernel variables with their values,
         * then make a callback.
         *
         * @param raw_string
         * @param callback
         */
        evaluateVariables: function(raw_string, callback) {
            var var_list = VariableManager.getVariableList(raw_string);
            VariableManager.evaluateList(var_list, function(value_map) {
                var final_string = VariableManager.replaceVariables(raw_string, value_map);
                callback(final_string);
            });
        }
    };

    var TaskWidgetView = widgets.DOMWidgetView.extend({
        render: function () {
            let cell = this.options.cell;

            // Ugly hack for getting the Cell object in ipywidgets 7
            if (!cell) cell = this.options.output.element.closest(".cell").data("cell");

            var code = null;

            // Protect against double-rendering
            if (cell.element.find(".gp-widget").length > 0) return;

            var lsid = this.model.get('lsid');
            var name = this.model.get('name');

            // Check to see if this is a legacy task widget, if so update the code
            if (!('genepattern' in cell.metadata) || cell.get_text().indexOf("gp.GPTask(gpserver") > -1) {
                code = cell.get_text().replace("GPTaskWidget", "genepattern.GPTaskWidget");
                code = code.replace("# !AUTOEXEC\n\n", "");
                code = code.replace("# !AUTOEXEC\n\n", "");

                // Add the metadata
                GPNotebook.slider.makeGPCell(cell, "task");

                // Add the code to the cell
                cell.set_text(code);
            }

            // Render the view.
            if (!this.el) this.setElement($('<div></div>'));

            // Determine which identifier is used
            if (lsid) {
                $(this.$el).runTask({
                    lsid: lsid,
                    cell: cell
                });
            }
            else {
                $(this.$el).runTask({
                    name: name,
                    cell: cell
                });
            }

            // Hide the code by default
            var element = this.$el;
            var hideCode = function() {
                var cell = element.closest(".cell");
                if (cell.length > 0) {
                    // Protect against the "double render" bug in Jupyter 3.2.1
                    element.parent().find(".gp-widget-task:not(:first-child)").remove();

                    element.closest(".cell").find(".input")
                        .css("height", "0")
                        .css("overflow", "hidden");
                }
                else {
                    setTimeout(hideCode, 10);
                }
            };
            setTimeout(hideCode, 1);
        }
    });

    return {
        TaskWidgetView: TaskWidgetView,
        VariableManager: VariableManager
    }
});