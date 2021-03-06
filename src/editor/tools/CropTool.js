/* Wick - (c) 2016 Zach Rispoli, Luca Damasco, and Josh Rispoli */

var CropTool = function (wickEditor) {

    var that = this;
    var fabricInterface = wickEditor.interfaces['fabric'];
    var canvas = fabricInterface.canvas;

    this.getCursorImage = function () {
        return "crosshair";
    }

    fabricInterface.canvas.on('mouse:down', function (e) {
        if(!(fabricInterface.currentTool instanceof CropTool)) return;

        fabricInterface.shapeDrawer.startDrawingShape('rectangle', e.e.offsetX, e.e.offsetY, that.cropWithShape, {crop:true});
    });

    this.cropWithShape = function (drawingShape) {
        fabricInterface.canvas.remove(drawingShape);
        wickEditor.syncInterfaces();

        wickEditor.interfaces.fabric.getObjectsImage(function (data) { 
            if(!data) return;
            CropImage(data.src, function (src) {
                var wickObj = WickObject.fromImage(src, function (wickObj) {
                    wickObj.x = drawingShape.left + drawingShape.width/2;
                    wickObj.y = drawingShape.top + drawingShape.height/2;
                    wickObj.selectOnAddToFabric = true
                    wickEditor.actionHandler.doAction('addObjects', {wickObjects:[wickObj], });
                });
            }, {
                x : drawingShape.left-data.x,
                y : drawingShape.top-data.y,
                width : drawingShape.width,
                height : drawingShape.height
            })
        });
    }

}