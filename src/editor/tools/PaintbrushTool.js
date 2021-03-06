/* Wick - (c) 2016 Zach Rispoli, Luca Damasco, and Josh Rispoli */

// Note: The actual drawing using the mouse is handled by fabric! See FabricInterface

var PaintbrushTool = function (wickEditor) {

    var that = this;

    this.getCursorImage = function () {
        var canvas = document.createElement("canvas");
        canvas.width = 128;
        canvas.height = 128;
        var context = canvas.getContext('2d');
        var centerX = canvas.width / 2;
        var centerY = canvas.height / 2;
        var radius = that.brushSize/2 * wickEditor.interfaces.fabric.canvas.getZoom();

        function invertColor(hexTripletColor) {
            var color = hexTripletColor;
            color = color.substring(1); // remove #
            color = parseInt(color, 16); // convert to integer
            color = 0xFFFFFF ^ color; // invert three bytes
            color = color.toString(16); // convert to hex
            color = ("000000" + color).slice(-6); // pad with leading zeros
            color = "#" + color; // prepend #
            return color;
        }

        context.beginPath();
        context.arc(centerX, centerY, radius+1, 0, 2 * Math.PI, false);
        context.fillStyle = invertColor(that.color);
        context.fill();

        context.beginPath();
        context.arc(centerX, centerY, radius, 0, 2 * Math.PI, false);
        context.fillStyle = that.color;
        context.fill();

        return 'url(' + canvas.toDataURL() + ') 64 64,default';
    };

    this.brushSize = 5;
    this.color = "#000000";

// Path vectorization

    // Listen for new paths drawn by fabric, vectorize them, and add them to the WickProject as WickObjects
    wickEditor.interfaces.fabric.canvas.on('object:added', function(e) {
        var fabricPath = e.target;

        // Make sure the new object is actually a path created by fabric's drawing tool
        if(fabricPath.type !== "path" || fabricPath.wickObjectID) {
            return;
        }

        fabricPath.isTemporaryDrawingPath = true; // So that fabric can remove it when it's time to add paths to the project as wickobjects

        // Vectorize the path and create a WickObject out of it
        potraceFabricPath(fabricPath, function(SVGData) {

            var wickObj = WickObject.fromSVG(SVGData);

            wickObj.x = fabricPath.left;
            wickObj.y = fabricPath.top;

            var symbolOffset = wickEditor.project.getCurrentObject().getAbsolutePosition();
            //wickObj.x -= symbolOffset.x;
            //wickObj.y -= symbolOffset.y;

            //wickObj.x -= fabricPath.width/2  + that.brushSize/2;
            //wickObj.y -= fabricPath.height/2 + that.brushSize/2;

            wickEditor.actionHandler.doAction('addObjects', {
                wickObjects: [wickObj]
            });

        });
    });

    var potraceFabricPath = function (pathFabricObject, callback) {
        // I think there's a bug in cloneAsImage when zoom != 1, this is a hack
        var oldZoom = wickEditor.interfaces.fabric.canvas.getZoom();
        wickEditor.interfaces.fabric.canvas.setZoom(1);

        pathFabricObject.cloneAsImage(function(clone) {
            var img = new Image();
            img.onload = function () {
                potraceImage(img, callback);
            };
            img.src = clone._element.currentSrc || clone._element.src;
        });

        // Put zoom back to where it was before
        wickEditor.interfaces.fabric.canvas.setZoom(oldZoom);
    };

    var potraceImage = function (img, callback) {

        // Scale the image before we pass it to potrace (fixes retina display bugs!)
        var dummyCanvas = document.createElement('canvas');
        var dummyContext = dummyCanvas.getContext('2d');
        //var zoom = wickEditor.interfaces.fabric.canvas.getZoom();
        dummyCanvas.width = img.width/window.devicePixelRatio;
        dummyCanvas.height = img.height/window.devicePixelRatio;
        dummyContext.drawImage(img, 0,0, img.width,img.height, 0,0, img.width/window.devicePixelRatio,img.height/window.devicePixelRatio);
        
        // Send settings and the image data to potrace to vectorize it!
        Potrace.loadImageFromDataURL(dummyCanvas.toDataURL());
        Potrace.setParameter({
            optcurve: true, 
            alphamax: 1.0
        });
        Potrace.process(function(){
            var SVGData = {
                svgString: Potrace.getSVG(1), 
                fillColor: that.color
            }
            callback(SVGData);
        });
    };

}