/* Wick - (c) 2016 Zach Rispoli, Luca Damasco, and Josh Rispoli */

var WickProject = function () {

    // Create the root object. The editor is always editing the root 
    // object or its sub-objects and cannot ever leave the root object.
    this.createNewRootObject();

    // Only used by the editor. Keeps track of current object editor is editing.
    this.currentObjectID = this.rootObject.id;
    this.rootObject.currentFrame = 0;

    this.name = "NewProject";

    this.onionSkinning = false;
    
    this.resolution = {};
    this.resolution.x = 720;
    this.resolution.y = 480;

    this.borderColor = "#DDDDDD";
    this.backgroundColor = "#FFFFFF";

    this.framerate = 6;

    this.fitScreen = false;
    this.borderColor = "#FFFFFF";

    this.renderer = "WickPixiRenderer";
    this.audioPlayer = "WickWebAudioPlayer";

};

WickProject.prototype.createNewRootObject = function () {
    var rootObject = new WickObject();
    rootObject.id = 0;
    rootObject.isSymbol = true;
    rootObject.isRoot = true;
    rootObject.playheadPosition = 0;
    rootObject.currentLayer = 0;
    rootObject.layers = [new WickLayer()];
    rootObject.x = 0;
    rootObject.y = 0;
    rootObject.opacity = 1.0;
    this.rootObject = rootObject;
}

/*****************************
    Import/Export
*****************************/

WickProject.fromFile = function (file, callback) {

    var reader = new FileReader();
    reader.onload = function(e) {
        if (file.type === "text/html") {
            callback(WickProject.fromWebpage(e.target.result));
        } else if (file.type === "application/json") {
            callback(WickProject.fromJSON(e.target.result));
        }
    };
    reader.readAsText(file);

}

WickProject.fromWebpage = function (webpageString) {

    var extractedProjectJSON;

    var webpageStringLines = webpageString.split('\n');
    webpageStringLines.forEach(function (line) {
        if(line.startsWith("<script>WickPlayer.runProject(")) {
            extractedProjectJSON = line.split("'")[1];
        }
    });

    if(!extractedProjectJSON) {
        // Oh no, something went wrong
        console.error("Bundled JSON project not found in specified HTML file (webpageString). The HTML supplied might not be a Wick project, or zach might have changed the way projects are bundled. See WickProjectExporter.js!");
        return null;
    } else {
        // Found a bundled project's JSON, let's load it!
        return WickProject.fromJSON(extractedProjectJSON);
    }
}

WickProject.fromJSON = function (rawJSONProject) {

    var JSONString = WickProjectCompressor.decompressProject(rawJSONProject);

    // Replace current project with project in JSON
    var projectFromJSON = JSON.parse(JSONString);

    // Put prototypes back on object ('class methods'), they don't get JSONified on project export.
    projectFromJSON.__proto__ = WickProject.prototype;
    WickObject.addPrototypes(projectFromJSON.rootObject);

    // Decode scripts back to human-readble and eval()-able format
    projectFromJSON.rootObject.decodeStrings();

    // Add references to wickobject's parents (optimization)
    projectFromJSON.rootObject.generateParentObjectReferences();

    // Backwards compatibility for old Wick projects: Add scripts to frames if they dont' have any
    var allObjectsInProject = projectFromJSON.rootObject.getAllChildObjectsRecursive();
    allObjectsInProject.push(projectFromJSON.rootObject);
    allObjectsInProject.forEach(function (wickObj) {
        if(!wickObj.isSymbol) return;

        wickObj.layers.forEach(function (layer) {
            layer.frames.forEach(function (frame) {
                if(!frame.wickScripts) {
                    frame.wickScripts = {
                        "onLoad" : "",
                        "onUpdate" : ""
                    }
                }
            })
        });
    });

    return projectFromJSON;
}

WickProject.fromLocalStorage = function () {

    if(!localStorage) {
        console.error("LocalStorage not available. Loading blank project");
        return new WickProject();
    }
    
    var autosavedProjectJSON = localStorage.getItem('wickProject');

    if(!autosavedProjectJSON) {
        console.log("No autosaved project. Loading blank project.");
        return new WickProject();
    }

    console.log("Loading project from local storage...");
    return WickProject.fromJSON(autosavedProjectJSON);

}

WickProject.prototype.getAsJSON = function (callback, args) {

    var that = this;

    console.log("Generating project JSON...");

    // Rasterize SVGs
    that.rootObject.generateSVGCacheImages(function () {
        // Encode scripts/text to avoid JSON format problems
        that.rootObject.encodeStrings();
        
        var JSONProject = JSON.stringify(that, WickProjectExporter.JSONReplacer);
        
        // Decode scripts back to human-readble and eval()-able format
        that.rootObject.decodeStrings();

        console.log("Done!");

        callback(JSONProject)
    });

}

WickProject.prototype.saveInLocalStorage = function () {
    wickEditor.interfaces.statusbar.setState('saving');
    this.getAsJSON(function (JSONProject) {
        var compressedJSONProject = WickProjectCompressor.compressProject(JSONProject, "LZSTRING-UTF16");
        WickProject.saveProjectJSONInLocalStorage(compressedJSONProject);
        wickEditor.interfaces.statusbar.setState('done');
    });
}

WickProject.saveProjectJSONInLocalStorage = function (projectJSON) {
    if(localStorage) {
        try {
            localStorage.setItem('wickProject', projectJSON);
            console.log("Project saved to local storage.");
        } catch (err) {
            console.error("LocalStorage could not save project, threw error:");
            console.log(err);
        }
    } else {
        console.error("LocalStorage not available.")
    }
}

WickProject.prototype.getCopyData = function (ids) {
    var objectJSONs = [];
    for(var i = 0; i < ids.length; i++) {
        objectJSONs.push(wickEditor.project.getObjectByID(ids[i]).getAsJSON());
    }
    var clipboardObject = {
        /*position: {top  : group.top  + group.height/2, 
                   left : group.left + group.width/2},*/
        groupPosition: {x : 0, 
                        y : 0},
        wickObjectArray: objectJSONs
    }
    return JSON.stringify(clipboardObject);
}

/*********************************
    Access project wickobjects
*********************************/

WickProject.prototype.regenerateUniqueIDs = function (wickObject) {
    var that = this;

    if(!wickObject.id && wickObject.id!=0) {
        //wickObject.id = this.rootObject.getLargestID() + 1; // Currently broken
        // This is silly, but the actionhandler freaks out if it has to add an object 
        // right after deleting another (those objects would have the same id.) (pls fix)
        wickObject.id = new Date().getTime() + this.rootObject.getLargestID();
    }

    if(wickObject.isSymbol) {
        wickObject.getAllChildObjects().forEach(function (child) {
            that.regenerateUniqueIDs(child);
        });
    }
}

WickProject.prototype.addObject = function (wickObject, zIndex) {

    var frame = this.getCurrentObject().getCurrentFrame();

    var insideSymbolOffset = this.getCurrentObject().getAbsolutePosition();
    wickObject.x -= insideSymbolOffset.x;
    wickObject.y -= insideSymbolOffset.y;
    
    if(zIndex === undefined) {
        frame.wickObjects.push(wickObject);
    } else {
        frame.wickObjects.splice(zIndex, 0, wickObject);
    }

    this.regenerateUniqueIDs(this.rootObject);
    this.rootObject.generateParentObjectReferences();

}

WickProject.prototype.getObjectByID = function (id) {

    return this.rootObject.getChildByID(id);

}

WickProject.prototype.getCurrentObject = function () {

    return this.getObjectByID(this.currentObjectID);

}

WickProject.prototype.jumpToObject = function (id) {

    var that = this;

    this.rootObject.getAllChildObjectsRecursive().forEach(function (child) {
        if(child.id === id) {
            that.currentObjectID = child.parentObject.id;
        }
    });

    var currentObject = this.getCurrentObject();
    var frameWithChild = currentObject.getFrameWithChild(this.rootObject.getChildByID(id));
    var playheadPositionWithChild = currentObject.getPlayheadPositionAtFrame(frameWithChild);
    currentObject.playheadPosition = playheadPositionWithChild;

}

WickProject.prototype.hasSyntaxErrors = function () {

    var projectHasSyntaxErrors = false;

    this.rootObject.getAllChildObjectsRecursive().forEach(function (child) {
        if(child.hasSyntaxErrors) {
            projectHasSyntaxErrors = true;
        }
    }); 

    return projectHasSyntaxErrors;

}

