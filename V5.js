/*global $, _, */
/**
 * @fileoverview This file is used for define the Mobile Web Framework
 * @author Jackson Tian
 * @version 0.1
 */

(function (global) {

    /**
     * @description The Framework's top object.
     * @namespace Top namespace, all components will be register under it.
     * @name V5
     */
    var V5 = function () {};

    /**
     * Mixin EventProxy.prototype into V5.prototype, make it has bind, unbind, trigger methods.
     */
    _.extend(V5, EventProxy.prototype);

    /**
     * @description Lets callback execute at a safely moment.
     * @param {function} callback The callback method that will execute when document is ready.
     */
    V5.ready = function (callback) {
        if (document.readyState === "complete") {
            callback();
        } else {
            var ready = function () {
                if (document.readyState === "complete") {
                    callback();
                    // Remove the callback listener from readystatechange event.
                    $(document).unbind("readystatechange", ready);
                }
            };
            //  Bind callback to readystatechange
            $(document).bind("readystatechange", ready);
        }
    };

    /**
    * @description Gets the V5 mode, detects the V5 runing in which devices.
    */
    V5.mode = window.innerWidth < 768 ? "phone" : "tablet";

    /**
    * @description Viewport references, detected by V5.mode.
    */
    V5.viewport = null;

    /**
     * @description Startups V5 framework.
     */
    V5.init = function () {
        V5.ready(function () {
            V5.viewport = $("#container");
            V5.setOrientation();
            window.addEventListener("touchmove", function (e) {e.preventDefault(); }, false);
            window.addEventListener('popstate', function (event) {
                var params = event.state;
                if (params) {
                    var args = params.split("/");
                    var currentHash = args.shift();
                    console.log("Hash Changed: " + currentHash);
                    if (V5.hashHistory.length) {
                        console.log(V5.hashHistory);
                        if (currentHash !== undefined) {
                            var topHash = _.map(V5.hashMap, function (val, key) {
                                return _.last(val);
                            });
                            if (_.include(topHash, params)) {
                                console.log("changed, but no action.");
                            } else {
                                var hashStack = _.compact(_.map(V5.hashMap, function (val, key) {
                                    return _.include(val, currentHash) ? key : null;
                                }));
                                console.log(hashStack);
                                V5.hashMap[hashStack[0]].pop();
                                V5.trigger("openView", currentHash, _.indexOf(V5.columns, hashStack[0]));
                                console.log("Forward or back");
                            }
                        }
                    }
                }
            }, false);

            if (V5.hashHistory.length === 0) {
                // TODO Case is fresh
                var map = V5.hashMap;
                if (_.size(map)) {
                    // TODO Restore view from session.
                    console.log("Restore from session.");
                    V5.restoreViews();
                } else {
                    // TODO Init view.
                    console.log("Init view.");
                    V5.initView();
                }
            }
        });
    };

    var body = $("body");
    V5.setOrientation = function () {
        var _setOrientation = function () {
            var orient = Math.abs(window.orientation) === 90 ? 'landscape' : 'portrait';
            var aspect = orient === 'landscape' ? 'portrait' : 'landscape';
            body.removeClass(aspect).addClass(orient);
        };
        _setOrientation();
        window.addEventListener('orientationchange', _setOrientation, false);
    };

    /**
     * @description Cache the page html.
     */
    V5._pageCache = {};

    V5.columns = ["alpha", "beta", "gamma"];
    V5.columnModes = ["single", "double", "triple"];

    V5.bind("openView", function (viewName, effectColumn, args, viewport) {
        if (V5.mode === "phone") {
            effectColumn = 0;
        }
        args = args || [];
        viewport = viewport || V5.viewport;
        V5.displayView(viewName, effectColumn, args, viewport);
        var hash = [viewName].concat(args).join("/");
        history.pushState(hash, viewName, "#" + hash);
    });

    V5.initView = function () {
        V5.trigger("openView", "index", 0);
    };

    V5.restoreViews = function () {
        var map = V5.hashMap;
        console.log(map);
        _.each(map, function (viewNames, columnName) {
            var hash = viewNames.pop();
            var args = hash.split("/");
            V5.trigger("openView", args.shift(), _.indexOf(V5.columns, columnName), args, V5.viewport);
        });
    };

    /**
     * @description Gets View from cache or server. If the view file come from server, 
     * the callback will be executed async, and cache it.
     * @param {string} viewName View name.
     * @param {function} callback Callback function, will be called after got the view from cache or server.
     */
    V5.getView = function (viewName, enableL10N, callback) {
        var _pageCache = V5._pageCache;
        var page = V5._pages[viewName];
        var proxy = new EventProxy();
        proxy.assign("l10n", "view", function (l10n, view) {
            var html = V5.localize(view, l10n);
            page.resources = l10n;
            callback($(html));
        });

        if (_pageCache[viewName]) {
            proxy.trigger("view", _pageCache[viewName]);
        } else {
            $.get("pages/" + viewName + ".page?_=" + new Date().getTime(), function (text) {
                // Save into cache.
                _pageCache[viewName] = text;
                proxy.trigger("view", _pageCache[viewName]);
            });
        }

        // Fetch the localize resources.
        if (page.enableL10N) {
            V5.fetchL10N(viewName, function () {
                proxy.trigger("l10n", V5.L10N[V5.langCode][viewName]);
            });
        } else {
            proxy.trigger("l10n", {});
        }
    };

    V5.displayView = function (hash, effectColumn, args, viewport) {
        var columnName = V5.columns[effectColumn];
        var column = viewport.find("." + columnName);
        if (column.size() < 1) {
            column = $("<div><div class='column_loading'><div class='loading_animation'></div></div></div>");
            column.addClass(columnName);
            viewport.append(column);
        }

        if (viewport === V5.viewport) {
            if (V5.hashMap[columnName]) {
                V5.hashMap[columnName].push([hash].concat(args).join("/"));
            } else {
                V5.hashMap[columnName] = [[hash].concat(args).join("/")];
            }
            V5.hashHistory.push([hash].concat(args));
        }


        var previousPage = column.find("section.page.active").removeClass("active");
        if (previousPage.length) {
            var id = previousPage.attr('id');
            var previous = V5._pages[id];
            if (previous && id !== hash) {
                previous.shrink();
            }
        }

        var loadingNode = column.find(".column_loading").removeClass("hidden");
        var page = V5._pages[hash];
        V5.getView(hash, page.enableL10N, function (view) {
            loadingNode.addClass("hidden");
            if (viewport === V5.viewport) {
                viewport.attr("class", V5.columnModes[_.size(V5.hashMap) - 1]);
            }
            if (page) {
                page.columnIndex = _.indexOf(V5.columns, columnName);
                if (!page.initialized) {
                    column.append(view);
                    page.node = view;
                    page.initialize.apply(page, args);
                    page.initialized = true;
                } else {
                    if (page.parameters.toString() !== args.toString()) {
                        page.destroy();
                        page.node.remove();
                        page.initialized = false;
                        V5.getView(hash, page.enableL10N, arguments.callee);
                        return;
                    } else {
                        page.reappear();
                    }
                }

                page.node.addClass("active");
                page.parameters = args;
                page.viewport = viewport;
            }
        });
    };

    V5.hashHistory = [];

    V5.sessionHistory = (function () {
        var session = getStorage("session");

        $(window).bind("unload", function () {
            session.put("history", V5.hashHistory);
        });
        return session.get("history");
    }());

    V5.hashMap = (function () {
        var session = getStorage("session");
        var hashMap = session.get("hashMap");
        if (!hashMap) {
            hashMap = {};
        } else {
            session.remove("hashMap");
        }
        $(window).bind("unload", function () {
            session.put("hashMap", V5.hashMap);
        });
        return hashMap;
    }());

    global.V5 = V5;
}(window));

/**
 * View
 */
(function (global) {
    /**
     * @description A factory method to generate View object. Packaged on Backbone.View.
     * @param {node} node a Zepto element node.
     * @returns {View} View object, based on Backbone.View.
     */
    V5.View = function (node) {
        var View = Backbone.View.extend({
            el: node,
            bind: function (name, method) {
                this[name] = method;
            },
            undelegateEvents: function () {
                $(this.el).unbind();
            }
        });
        return new View();
    };

}(window));
/**
 * Templates
 */
(function (global) {
    var V5 = global.V5;
    V5._templates = {};

    /**
     * @description templateMode, optimized or normal.
     */
    V5.templateMode = "normal";

    var getTemplateNormally = function (name, callback) {
        var template = V5._templates[name];
        if (template) {
            callback(template);
        } else {
            $.get("templates/" + name + ".tmpl?_=" + new Date().getTime(), function (templ) {
                V5._templates[name] = templ;
                callback(templ);
            });
        }
    };

    var getTemplateOptimized = function (name, callback) {
        var template = V5._templates[name];
        if (template) {
            callback(template);
        } else {
            $.get("templates/optimized_combo.tmpl?_=" + new Date().getTime(), function (templ) {
                $(templ).find("script").each(function (index, script) {
                    var templateNode = $(script);
                    var id = templateNode.attr("id");
                    V5._templates[id] = templateNode.html();
                });
                callback(V5._templates[name]);
            });
        }
    };

    /**
     * @description Fetch the template file.
     */
    V5.getTemplate = function (name, callback) {
        if (V5.templateMode === "normal") {
            getTemplateNormally(name, callback);
        } else {
            getTemplateOptimized(name, callback);
        }
    };

}(window));

/**
 * Page defined
 */
(function (global) {
    var V5 = global.V5;
    /**
     * @description Page namespace. All page module will be stored at here.
     * @namespace 
     * @private
     */
    V5._pages = {};

    /**
     * @description Register a page to V5.
     * @param {string} name Page id, used as key, V5 framework find page element by this name
     * @param {function} The module object.
     */
    V5.registerPage = function (name, module) {
        if (typeof module === "function") {
            V5._pages[name] = new V5.Page(module());
        }
    };

    /**
    * @description Define a page component.
    * @constructor V5.Page.
    * @param {function} module Module object.
    */    
    var Page = function (module) {
        // Mixin the eventproxy's prototype
        _.extend(this, EventProxy.prototype);
        /**
         * @description The Initialize method.
         * @field {function} initialize
         */
        this.initialize = function () {};
        /**
         * @description The Shrink method, will be invoked when hide current view.
         * @field {function} initialize
         */
        this.shrink = function () {};
        /**
         * @description The Reappear method, when View reappear after shrink, this function will be invoked.
         * @field {function} reappear
         */
        this.reappear = function () {};
        /**
         * @description The Destroy method, should be invoked manually when necessary.
         * @field {function} reappear
         */
        this.destroy = function () {};
        /**
         * @description Parameters, store the parameters, for check the view whether changed.
         * @field {Array} parameters
         */
        this.parameters = null;
        /**
         * @description Flag whether enable localization.
         */
        this.enableL10N = false;
        // Merge the module's methods
        _.extend(this, module);
    };

    /**
     * @description Open a view from current column or next column.
     */
    Page.prototype.openView = function (hash, blank) {
        var effectColumn;
        if (blank) {
            effectColumn = this.columnIndex + 1;
        } else {
            effectColumn = this.columnIndex;
        }
        var args = hash.split("/");
        var viewName = args.shift();
        V5.trigger("openView", viewName, effectColumn, args);
    };

    /**
     * @description Open a viewport and display a page.
     */
    Page.prototype.openViewport = function (hash) {
        var args = hash.split("/");
        var view  = args.shift();
        var viewport = $("<div></div>").addClass("viewport");
        $(document.body).append(viewport);
        V5.trigger("openView", view, 0, args, viewport);
    };

    /**
     * @description Destroy current page and close current viewport.
     */
    Page.prototype.closeViewport = function (hash) {
        this.destroy();
        this.node.remove();
        delete this.node;
        this.initialized = false;
        this.viewport.remove();
        delete this.viewport;
    };

    /**
     * @description Call a common module.
     */
    Page.prototype.call = function (moduleId) {
        var module = V5._modules[moduleId];
        if (module) {
            module.V5ly(this, []);
        } else {
            throw moduleId + " Module doesn't exist";
        }
    };

    /**
     * @description Post message to Page.
     */
    Page.prototype.postMessage = function (event, data) {
        this.trigger("page:" + event, data);
        return this;
    };

    /**
     * @description Bind message event.
     */
    Page.prototype.onMessage = function (event, callback) {
        this.bind("page:" + event, callback);
        return this;
    };

    V5.Page = Page;
}(window));

/**
 * Module
 */
(function (global) {
    var V5 = global.V5;

    V5._modules = {};

    /**
     * @description Call a common module.
     */
    V5.registerModule = function (moduleId, module) {
        V5._modules[moduleId] = module;
    };

}(window));

/**
 * Localization
 */
(function (global) {
    var V5 = global.V5;

    /**
     * @description Local code.
     */
    V5.langCode = "en-US";

    /**
     * @description All localization resources will be stored at here by locale code.
     * @namespace Localization resources namespace.
     */
    V5.L10N = {};

    /**
     * @description Gets localization resources by view name.
     * @param {string} viewName View name
     * @param {function} callback Callback that will be invoked when sources is got.
     */
    V5.fetchL10N = function (viewName, callback) {
        var code = V5.langCode;
        $.getJSON("languages/" + viewName + "_" + code + ".lang?_=" + new Date().getTime(), function (data) {
            // Sets l10n resources to V5.L10N
            V5.L10N[code] = V5.L10N[code] || {};
            _.extend(V5.L10N[code], data);
            callback(V5.L10N[code]);
        });
    };

    /**
     * @desciption A wrapper method to localize template with the resources. 
     * @param {string} template template string.
     * @param {object} resources resources object.
     * @returns rendered html string.
     */
    V5.localize = function (template, resources) {
        var settings = {
                interpolate : /\{\{(.+?)\}\}/g
            };
        var compiled = _.compile(template, settings);
        return compiled(resources);
    };

}(window));

/**
 * V5 message mechanism.
 */
(function (global) {
    var V5 = global.V5;
    V5.postMessage = function (hash, event, data) {
        var page = V5._pages[hash];
        if (page) {
            page.postMessage(event, data);
        }
    };
}(window));
