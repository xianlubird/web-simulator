/*
 *  Copyright 2011 Research In Motion Limited.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var db = require('ripple/db'),
    exception = require('ripple/exception'),
    utils = require('ripple/utils'),
    devices = require('ripple/devices'),
    constants = require('ripple/constants'),
    event = require('ripple/event'),
    _win,
    _doc,
    _self;

function _validateLayoutType(layoutType) {
    return (layoutType === "landscape" || layoutType === "portrait");
}

function _validateOrientation(orientation) {
    return (orientation === "landscape" || orientation === "portrait");
}

function _getContainers() {
    return {
        device: {
            div: document.getElementById("device-container"),
            containerClass: document.getElementById("device-container").getAttribute("class") || ""
        },
        viewport: {
            div: document.getElementById("viewport-container"),
            containerClass: document.getElementById("viewport-container").getAttribute("class") || ""
        },
        "menu-button": {
            div: document.getElementById(constants.COMMON.MENU_BUTTON),
            containerClass: document.getElementById(constants.COMMON.MENU_BUTTON).getAttribute("class") || ""
        },
        "back-button": {
            div: document.getElementById(constants.COMMON.BACK_BUTTON),
            containerClass: document.getElementById(constants.COMMON.BACK_BUTTON).getAttribute("class") || ""
        }
    };
}

function _setContainers(containers, device, orientation) {
    var suffix = {
            portrait:  "-wrapper" + (device.skin ? "-" + device.skin : ""),
            landscape: "-wrapper-landscape" + (device.skin ? "-" + device.skin : "")
        };

    utils.forEach(containers, function (container, key) {
        container.div.setAttribute("class", container.containerClass.replace(/\s.*$/, "") + " " + key + suffix[orientation]);
    });
}

function _getDimensions(device, orientation) {
    return {
        deviceWidth: orientation === "portrait" ? device.screen.width : device.screen.height,
        deviceHeight: orientation === "portrait" ? device.screen.height : device.screen.width,
        paddingLeft: device.viewPort[orientation].paddingLeft,
        paddingTop: device.viewPort[orientation].paddingTop,
        viewPort: {
            width: device.viewPort[orientation].width,
            height: device.viewPort[orientation].height
        }
    };
}

function _formatSkin(containers, dimensions) {
    var scaleFactor = dimensions.deviceWidth / dimensions.viewPort.width,
    scaleString = "scale(" + scaleFactor + ")";

    containers.device.div.style.width = (dimensions.deviceWidth + 4) + "px";
    containers.device.div.style.height = (dimensions.deviceHeight + 4) + "px";
    containers.viewport.div.style.width = dimensions.viewPort.width + "px";
    containers.viewport.div.style.height = dimensions.viewPort.height + "px";
    containers.viewport.div.style.padding = "0";

    jQuery('#viewport-container').css('-webkit-transform', scaleString);
    jQuery('#viewport-container').css('-webkit-transform-origin', 'left top');
}

function _setOrientation(layout) {
    _win.orientation = window.orientation = layout === "portrait" ? 0 : 90;
}

function _upDateHWKeyPanelPosition(orientation, scaleFactor) {
    var left = 0;

    if (orientation === 'portrait') {
        if (db.retrieve("layout") === "portrait") {
            left = 350 + $('#device-layout').width()*scaleFactor;
        } else {
            left = 470 + $('#device-layout').height()*scaleFactor;
        }
    } else {
        if (db.retrieve("layout") === "portrait") {
            left = 490 + $('#device-layout').height()*scaleFactor;
        } else {
            left = 350 + $('#device-layout').width()*scaleFactor;
        }
    }

    $("#hwkeys-panel").css("top", "40px");
    $("#hwkeys-panel").css("left", left+"px");
}

function _getTransformString(orientation, scaleFactor) {
    var transformString = "",
    offset;

    if (orientation === "landscape") {
        if (db.retrieve("layout") === "portrait") {
            offset = devices.getCurrentDevice().screen.height * scaleFactor + 170;
            transformString = "translate("+ offset + "px, 0px) rotate(90deg) scale("+ scaleFactor +")";
        } else {
            transformString = "translate(0px,0px) rotate(0deg) scale("+ scaleFactor +")";
        }
    } else {
        if (db.retrieve("layout") === "portrait") {
            transformString = "translate(0px,0px) rotate(0deg) scale("+ scaleFactor +")";
        } else {
            offset = devices.getCurrentDevice().screen.width * scaleFactor + 150;
            transformString = "translate("+ offset + "px, 0px) rotate(90deg) scale("+ scaleFactor +")";
        }
    }

    return transformString;
}


_self = {
    init: function (win, doc) {
        _win = win;
        _doc = doc;

        var layout = db.retrieve("layout") || "portrait";

        _setOrientation(layout);

        _win.onorientationchange = undefined;
    },
    // TODO: redo/refactor this in general, seems bloated, also devices REQUIRE viewport schemas which they shouldnt
    resize: function (device) {
        var layout = db.retrieve("layout"),
            orientation = "portrait",
            containers, dimensions;

        if (layout && layout === "landscape" && device.viewPort.landscape) {
            orientation = "landscape";
        }

        containers = _getContainers();
        _setContainers(containers, device, orientation);

        dimensions = _getDimensions(device, orientation);
        if (!device.skin) {
            _formatSkin(containers, dimensions);
        }

        event.trigger("ScreenChangeDimensions", [dimensions.viewPort.width, dimensions.viewPort.height]);
    },

    changeLayoutType: function (layoutType) {
        var orientation = db.retrieve("deviceOrientation") || "portrait";
        if (!_validateLayoutType(layoutType)) {
            exception.raise(exception.types.LayoutType, "unknown layout type requested!");
        }

        db.save("layout", layoutType);
        _self.resize(devices.getCurrentDevice());
        _self.rotateDevice(orientation);

        if (!_win) return;
        _setOrientation(layoutType);
    },

    scaleDevice: function (scaleFactor) {
        var orientation = db.retrieve("deviceOrientation") || "portrait",
        transformString = _getTransformString(orientation, scaleFactor);
        _upDateHWKeyPanelPosition(orientation, scaleFactor);
        db.save("deviceScaleFactor", scaleFactor);
        jQuery('#device-layout').css('-webkit-transform-origin', '0% 0%');
        jQuery('#device-layout').css('-webkit-transform',  transformString);
    },

    rotateDevice: function (orientation) {
        if (!_validateOrientation(orientation)) {
            exception.raise(exception.types.OrientationType, "unknown orientation type requested!");
        }

        db.save("deviceOrientation", orientation);
        jQuery('#device-layout').css('-webkit-transform-origin', '0% 0%');
        jQuery('#device-layout').css('-webkit-transform',
                _getTransformString(orientation, db.retrieve("deviceScaleFactor")));
        _upDateHWKeyPanelPosition(orientation, db.retrieve("deviceScaleFactor"))
        if (!_win) return;
        if (_win.onorientationchange) {
            _win.onorientationchange();
        }

        var evt = _doc.createEvent("Event");
        evt.initEvent("orientationchange", true, true);
        _win.dispatchEvent(evt);
    }
};

module.exports = _self;
