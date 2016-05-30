/* NOTE: The names 'static' and 'dynamic' are temporary...
   Need to find other names that makes sense */

/*****************************
	Object 
*****************************/

var WickObject = function () {

	// Note that the root object is the only object with parentObject as null.
	this.parentObject = null;

	this.currentFrame = null;

	this.isSymbol = false;

	this.dataURL = undefined;

	// Dictionary mapping function names to WickScript object
	this.wickScripts = null;

};

WickObject.prototype.getCurrentFrame = function() {

	return this.frames[this.currentFrame];

}

WickObject.prototype.addEmptyFrame = function(newFrameIndex) {

	this.frames[newFrameIndex] = new WickFrame();

}

/*****************************
	Frames
*****************************/

// Stores a bunch of wickobjects.

var WickFrame = function () {

	this.wickObjects = [];

};