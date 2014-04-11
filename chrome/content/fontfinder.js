var fontFinder = {};
(function() {
  this.namespace = new Object;
  this.namespace.analyzedFonts = false;
  this.namespace.key = false;
  this.namespace.label = false;
  this.copiers = [
    "hex",
    "font-family",
    "font-size",
    "id",
    "class",
    "all"
  ];
  this.detective = false;
  this.loaded = false;
  this.prefManager = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);  
  
  /* Handle any changes made to this add-on's options */
  this.update = function(type){
    if(type == "statusbar"){
      var e = document.getElementById("disable-font-options");
      var e2 = document.getElementById("replace-font-options");
      //Decide whether or not the user wants the statusbar icon displayed
      if(fontFinder.prefManager.getBoolPref("extensions.fontfinder@bendodson.com.statusbar")){
        document.getElementById('fontfinder_statusbar_outer').style.display='';
        if( e )
        {
          e.addEventListener("popupshowing", fontFinder.showContextMenu, false);
          e2.addEventListener("popupshowing", fontFinder.showContextMenu, false);
        }
      } else {
        document.getElementById('fontfinder_statusbar_outer').style.display='none';
        if( e )
        {
          e.removeEventListener("popupshowing", fontFinder.showContextMenu, false);
          e2.removeEventListener("popupshowing", fontFinder.showContextMenu, false);
        }
      }
    } else {
      var e = document.getElementById("disable-font-options-context");
      var e2 = document.getElementById("replace-font-options-context");
      //For the context-menu, we need to turn the listener on/off
      if(fontFinder.prefManager.getBoolPref("extensions.fontfinder@bendodson.com.contextmenu")){
        if( e )
        {
          e.addEventListener("popupshowing", fontFinder.showContextMenu, false);
          e2.addEventListener("popupshowing", fontFinder.showContextMenu, false);
        }
      } else {
        document.getElementById('fontfinder-menu').style.display = 'none';
        if( e )
        {
          e.removeEventListener("popupshowing", fontFinder.showContextMenu, false);
          e2.removeEventListener("popupshowing", fontFinder.showContextMenu, false);
        }
      }
    }
  }
  
  /* Handle disabling the status-bar through the right-click */
  this.disableStatusBar = function(){
    fontFinder.prefManager.setBoolPref("extensions.fontfinder@bendodson.com.statusbar",false);
  }
  
  this.populateFonts = function()
  {
    //Only analyze the dom when absolutely necessary
    if(fontFinder.namespace.analyzedFonts == false){
      const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
      //Clear out the existing menus
      var disableElementStatusbar = document.getElementById("disable-font-options");
      var disableElementContextmenu = document.getElementById("disable-font-options-context");
      var replaceElementStatusbar = document.getElementById("replace-font-options");
      var replaceElementContextmenu = document.getElementById("replace-font-options-context");
      while(disableElementStatusbar.hasChildNodes()){
        disableElementStatusbar.removeChild(disableElementStatusbar.firstChild);
        disableElementContextmenu.removeChild(disableElementContextmenu.firstChild);
        replaceElementStatusbar.removeChild(replaceElementStatusbar.firstChild);
        replaceElementContextmenu.removeChild(replaceElementContextmenu.firstChild);
      }
      
      //Alphabetize and attach the fonts to the menus
      var docFonts = this.findAllFonts().sort();
      var item = false;
      for(var i = 0; i < docFonts.length; i++){
        //The disable options
        item = document.createElementNS(XUL_NS, "menuitem");
        item.setAttribute("label", docFonts[i]);
        if(docFonts.length <= 1 && docFonts[i].toLowerCase() == 'serif'){
          item.onclick = function(){alert("Cannot disable font, 'serif' is the core font");};
        } else {
          //item.setAttribute("onclick", 'fontFinder.disableFont("'+docFonts[i]+'")');
          item.setAttribute("docFonts", docFonts[i]);
          item.addEventListener("click", function (e) {
            var d = e.target.getAttribute("docFonts");
            fontFinder.disableFont(d);
          }, false);
        }
        disableElementStatusbar.appendChild(item);
        item = document.createElementNS(XUL_NS, "menuitem");
        item.setAttribute("label", docFonts[i]);
        if(docFonts.length <= 1 && docFonts[i].toLowerCase() == 'serif'){
          item.onclick = function(){alert("Cannot disable font, 'serif' is the core font");};
        } else {
          //item.setAttribute("onclick", 'fontFinder.disableFont("'+docFonts[i]+'")');
          item.setAttribute("docFonts", docFonts[i]);
          item.addEventListener("click", function (e) {
            var d = e.target.getAttribute("docFonts");
            fontFinder.disableFont(d);
          }, false);
        }
        disableElementContextmenu.appendChild(item);

        //The replace options
        item = document.createElementNS(XUL_NS, "menuitem");
        item.setAttribute("label", docFonts[i]);
        //item.setAttribute("onclick", 'fontFinder.replaceFont("'+docFonts[i]+'")');
        item.setAttribute("docFonts", docFonts[i]);
        item.addEventListener("click", function (e) {
          var d = e.target.getAttribute("docFonts");
          fontFinder.replaceFont(d);
        }, false);
        replaceElementStatusbar.appendChild(item);
        item = document.createElementNS(XUL_NS, "menuitem");
        item.setAttribute("label", docFonts[i]);
        //item.setAttribute("onclick", 'fontFinder.replaceFont("'+docFonts[i]+'")');
        item.setAttribute("docFonts", docFonts[i]);
        item.addEventListener("click", function (e) {
          var d = e.target.getAttribute("docFonts");
          fontFinder.replaceFont(d);
        }, false);
        replaceElementContextmenu.appendChild(item);
      }
      fontFinder.namespace.analyzedFonts = true;
    }
    return;
  };

  /* Handle actions in the status bar */
  this.toggleStatusBar = function(e)
  {
    /* Let right-clicks open the popupset */
    if(e.button == 2){
      return;
    }

    //The first time the status bar is used, explain how it is used.
    if(fontFinder.prefManager.getBoolPref("extensions.fontfinder@bendodson.com.statusBarLeftClick") == false){
      alert("[Note: This message will appear only once.]\n\nYou may now left-click on any element of this page to analyze its font information.\nMore options, such as disabling fonts, copying font data to the clipboard, and adjusting various inline font settings, are available through the context-menu and through right-clicking this status bar icon.");
      fontFinder.prefManager.setBoolPref("extensions.fontfinder@bendodson.com.statusBarLeftClick",true);
    }

    //If the statusbar icon was clicked, and there's an active selection, analyze that
    var selection = window.content.getSelection();
    var selectionString = selection.toString();
    if(selectionString.length > 0){
      fontFinder.analyzeSelection();
    } else {
      // Toggle the event listener and the icon's appearance
      var curWin = document.commandDispatcher.focusedWindow;
      if(document.getElementById('fontfinder_statusbar').className == ""){
        gBrowser.addEventListener("click", fontFinder.statusBarSelect, true);
        gBrowser.addEventListener("focus", fontFinder.doNothing, true);
        document.getElementById('fontfinder_statusbar').className = 'on';
        curWin.document.getElementsByTagName("body")[0].style.cursor = 'crosshair';
      }else {
        gBrowser.removeEventListener("click", fontFinder.statusBarSelect, true);
        gBrowser.removeEventListener("focus", fontFinder.doNothing, true);
        document.getElementById('fontfinder_statusbar').className="";
        curWin.document.getElementsByTagName("body")[0].style.cursor = '';
      }
    }
  };

  /* Prevent the :focus actions from nuking a font we may care about */
  this.doNothing = function(e){
    e.stopPropagation();
    e.preventDefault();
  };
  
  //Handle the first click once the statusbar has been turned on
  this.statusBarSelect = function(e)
  {
    // Don't follow links
    fontFinder.doNothing(e);

    // Remove the event listener and set the icon back to "off"
    document.getElementById('fontfinder_statusbar').className="";
    var curWin = document.commandDispatcher.focusedWindow;
    curWin.document.getElementsByTagName("body")[0].style.cursor = '';
    gBrowser.removeEventListener("click", fontFinder.statusBarSelect, true);
    gBrowser.removeEventListener("focus", fontFinder.doNothing, true);
    
    if(fontFinder.getSelection(e))
      alert(fontFinder.namespace.allInfo);
  };
  
  //Helper function to grab the element that's currently highlighted
  this.getSelection = function(e)
  {
    var selection = window.content.getSelection();
    var selectionString = selection.toString();
    if(selectionString.length > 0){
      return fontFinder.analyzeSelection();
    } else {
      fontFinder.namespace.elementName = e.target.nodeName.toLowerCase();
      fontFinder.namespace.elementID = e.target.id;
      fontFinder.namespace.elementClass = e.target.className;
      fontFinder.evaluator(e.target, true);
      return true;
    }
  };
  
  //Analyze the selection
  this.analyzeSelection = function(allowNoSelect)
  {
    var selection = window.content.getSelection();
    var selectionString = selection.toString();
    if(selectionString.length == 0){
      fontFinder.reset();
      if(allowNoSelect){
        return -1;
      } else {
        alert("Nothing has been selected - please select an element and try again.");
        return false;
      }
    }
    var intSelectionAnchorOffset = selection.anchorOffset;
    var intSelectionFocusOffset = selection.focusOffset;

    var element = new Object;
    var mousedownContainer = selection.anchorNode;
    var mouseupContainer = selection.focusNode;
    if(mousedownContainer != mouseupContainer) {
      fontFinder.reset();
      alert("You have selected multiple elements - Please select a single element and try again.");
      return false;
    }
    var childNodeOfParentNodeForAnchorToSeek = mouseupContainer;
    var parentNodeForAnchor = mouseupContainer.parentNode;
    var parentNodeTagName = parentNodeForAnchor.nodeName;
    var selectionParentNodeElementID = '';
    if(parentNodeForAnchor.hasAttribute("ID")) {
      selectionParentNodeElementID = parentNodeForAnchor.getAttribute("ID");
      element = content.document.getElementById(selectionParentNodeElementID);
    } else {
      var arrDocumentGetElementsByTagName = content.document.getElementsByTagName(parentNodeTagName);
      elementsloop:for(var i=0; i<arrDocumentGetElementsByTagName.length; i++) {
        for(var j=0; j<arrDocumentGetElementsByTagName[i].childNodes.length; j++) {
          if(arrDocumentGetElementsByTagName[i].childNodes[j] == childNodeOfParentNodeForAnchorToSeek) {
            element = content.document.getElementsByTagName(parentNodeTagName)[i];
            break elementsloop;
          }
        }
      }
    }
    // Element Details
    fontFinder.namespace.elementName = parentNodeTagName.toLowerCase();
    fontFinder.namespace.elementID = selectionParentNodeElementID;
    fontFinder.namespace.elementClass = parentNodeForAnchor.className;
    fontFinder.evaluator(element);
    return element;
  };

  //Adjust the current selection
  this.adjustElement = function(type,label,gotElement)
  {
    if(!gotElement){
      var element = this.analyzeSelection(true);
      if(element == false){
        return;
      } else if(element == -1){
        //The first time the left-click after-event system is used, explain how it is used. 
        if(fontFinder.prefManager.getBoolPref("extensions.fontfinder@bendodson.com.analyzeLeftClick") == false){
          alert("[Note: This message will appear only once.]\n\nYou must now left-click on any element of this page to complete this action.");
          fontFinder.prefManager.setBoolPref("extensions.fontfinder@bendodson.com.analyzeLeftClick",true);
        }
        // Toggle the event listener and the icon's appearance
        var curWin = document.commandDispatcher.focusedWindow;
        fontFinder.namespace.key = type;
        fontFinder.namespace.label = label;
        gBrowser.addEventListener("click", fontFinder.replaceListener, true);
        gBrowser.addEventListener("focus", fontFinder.doNothing, true);
        curWin.document.getElementsByTagName("body")[0].style.cursor = 'crosshair';
        return;
      }
    } else {
      var element = gotElement;
    }

    var previousValue = fontFinder.namespace[type];
    element.style[type] = prompt('Please provide the new '+label,fontFinder.namespace[type]);    
    var newValue = element.style[type];
    fontFinder.evaluator(element);
    if(type == "fontFamily" && element.style[type].indexOf(',') == -1 && fontFinder.namespace.fontRendered != newValue){
      alert("Font of '"+newValue+"' not found.\nReverting to '"+previousValue+"'.");
      element.style.fontFamily = previousValue;
    }
    fontFinder.reset();
    return true;
  };

  //Track the clipboard left-click
  this.replaceListener = function(e)
  {
    // Don't follow links
    fontFinder.doNothing(e);

    // Remove the event listener and set the icon back to "off"
    var curWin = document.commandDispatcher.focusedWindow;
    curWin.document.getElementsByTagName("body")[0].style.cursor = '';
    gBrowser.removeEventListener("click", fontFinder.replaceListener, true);
    gBrowser.removeEventListener("focus", fontFinder.doNothing, true);
    
    fontFinder.namespace.elementName = e.target.nodeName.toLowerCase();
    fontFinder.namespace.elementID = e.target.id;
    fontFinder.namespace.elementClass = e.target.className;
    fontFinder.evaluator(e.target, true);

    fontFinder.adjustElement(fontFinder.namespace.key,fontFinder.namespace.label,e.target); 
  };

  //Analyze the provided element
  this.evaluator = function(element)
  {
    // SET ALL VARIABLES
    if (fontFinder.namespace.elementID == '') {
      fontFinder.namespace.elementID = "Not Applicable";
    }
    if (fontFinder.namespace.elementClass == '') {
      fontFinder.namespace.elementClass = "Not Applicable";
    }

    // Colors
    fontFinder.namespace.color = this.getStyle(element,'color');
    fontFinder.namespace.fontColorHex = this.getColor(fontFinder.namespace.color);
    fontFinder.namespace.fontBgColorRGB = this.getStyle(element,'background-color');
    if (fontFinder.namespace.fontBgColorRGB != 'transparent') {
      fontFinder.namespace.fontBgColorHex = "background-color: #" + this.getColor(fontFinder.namespace.fontBgColorRGB) + "\n";
    } else {
      fontFinder.namespace.fontBgColorHex = "";
    }

    // Font
    fontFinder.namespace.fontFamily = this.getStyle(element,'font-family');
    fontFinder.namespace.fontSize = this.getStyle(element,'font-size');

    // Spacing
    fontFinder.namespace.lineHeight = this.getStyle(element,'line-height');
    if (fontFinder.namespace.lineHeight != 'normal') {
      fontFinder.namespace.lineHeightOutput = this.roundTwoPlaces(this.roundAndRemove(fontFinder.namespace.lineHeight) / this.removePX(fontFinder.namespace.fontSize)) + "em "+
        "(" + this.roundAndRemove(fontFinder.namespace.lineHeight) + "px)";
    } else {
      fontFinder.namespace.lineHeightOutput = fontFinder.namespace.lineHeight;
    }

    fontFinder.namespace.verticalAlign = this.getStyle(element,'vertical-align');
    fontFinder.namespace.letterSpacing = this.getStyle(element,'letter-spacing');
    fontFinder.namespace.wordSpacing = this.getStyle(element,'word-spacing');

    // Decoration \ Transformation

    fontFinder.namespace.fontWeight = this.getStyle(element,'font-weight');
    if (fontFinder.namespace.fontWeight == "400") {
      fontFinder.namespace.fontWeight = "normal";
    }
    if (fontFinder.namespace.fontWeight == "401") {
      fontFinder.namespace.fontWeight = "bold";
    }

    fontFinder.namespace.fontStyle = this.getStyle(element,'font-style');
    fontFinder.namespace.fontVariant = this.getStyle(element,'font-variant');
    fontFinder.namespace.textTransform = this.getStyle(element,'text-transform');
    fontFinder.namespace.textDecoration = this.getStyle(element,'text-decoration');
    fontFinder.namespace.textAlign = this.getStyle(element,'text-align');
    fontFinder.namespace.textIndent = this.getStyle(element,'text-indent');
    
    fontFinder.loadDetective();
    var fonts = fontFinder.namespace.fontFamily.split(',');
    fontFinder.namespace.fontRendered = 'System Default';
    fontLoop:for (var i=0; i < fonts.length; i++) {
      if(fontFinder.detective.test(fonts[i])) {
        fontFinder.namespace.fontRendered = fonts[i];
        break fontLoop;
      }
    };

    // CREATE ALERT BOX
    fontFinder.namespace.allInfo = "Color\n" +
      "===============================\n" + 
      "color: #" + fontFinder.namespace.fontColorHex + "\n" +
      "color: " + fontFinder.namespace.color + "\n" +
      fontFinder.namespace.fontBgColorHex + 
      "background-color: " + fontFinder.namespace.fontBgColorRGB + "\n\n" +
      "Font\n" +
      "===============================\n" + 
      "font-family (stack): " + fontFinder.namespace.fontFamily + "\n" +
      "Font being rendered: " + fontFinder.namespace.fontRendered + "\n" +
      "font-size: " + fontFinder.namespace.fontSize + "\n\n" +
      "Spacing\n" +
      "===============================\n" + 
      "line-height: " + fontFinder.namespace.lineHeightOutput + "\n" +
      "vertical-align: " + fontFinder.namespace.verticalAlign + "\n" + 
      "letter-spacing: " + fontFinder.namespace.letterSpacing + "\n" +
      "word-spacing: " + fontFinder.namespace.wordSpacing + "\n\n" + 
      "Decoration \\ Transformation\n" +
      "===============================\n" + 
      "font-weight: " + fontFinder.namespace.fontWeight + "\n" +
      "font-style: " + fontFinder.namespace.fontStyle + "\n" + 
      "font-variant: " + fontFinder.namespace.fontVariant + "\n" + 
      "text-transform: " + fontFinder.namespace.textTransform + "\n" + 
      "text-decoration: " + fontFinder.namespace.textDecoration + "\n" + 
      "text-align: " + fontFinder.namespace.textAlign + "\n" + 
      "text-indent: " + fontFinder.namespace.textIndent + "\n\n" + 
      "Element Details\n" +
      "===============================\n" + 
      "Element Type: <" + fontFinder.namespace.elementName + ">\n" + 
      "Element ID: " + fontFinder.namespace.elementID + "\n" +
      "Element Class: " + fontFinder.namespace.elementClass + "\n";
  };

  //Inner class that's used to determine which font is rendered.
  //It operates under the foundation that each font has a unique height & width when given a large enough font size & sample string
  this.Detector = function(){
    var curWin = document.commandDispatcher.focusedWindow;
    var h = curWin.document.getElementsByTagName("body")[0];
    var d = curWin.document.createElement("div");
    var s = curWin.document.createElement("span");
    d.appendChild(s);
    d.style.fontFamily = "serif";
    s.style.fontFamily = "serif";
    s.style.fontSize   = "72px";
    s.innerHTML        = "mmmmmmmmmmlil";
    h.appendChild(d);
    var defaultWidth   = s.offsetWidth;  
    var defaultHeight  = s.offsetHeight;
    h.removeChild(d);
    function test(font){
      font = font.toLowerCase().replace(/^\s+|\s+$/g,"").replace(/['"]/g,'');
      h.appendChild(d);
      s.style.fontFamily = font;  
      var fontMatch = (s.offsetWidth != defaultWidth || s.offsetHeight != defaultHeight);
      h.removeChild(d);
      if (font == "serif")
      {
        return true;
      } else {
        return fontMatch;
      }
    }
    this.test = test;  
  };  
  
  this.arrayUnique = function(input){
    var a = [];
    var l = input.length;
    for(var i=0; i<l; i++) {
      for(var j=i+1; j<l; j++) {
        // If this[i] is found later in the array
        if (input[i] === input[j])
          j = ++i;
      }
      a.push(input[i]);
    }
    return a;
  };
  
  //Trim any whitespace, remove all quotes and apostrophes, and convert to lowercase
  this._cleanFontName = function(font){
    return font.toLowerCase().replace(/^\s+|\s+$/g,"").replace(/['"]/g,'');
  };
  
  this.findAllFonts = function()
  {
    var curWin = document.commandDispatcher.focusedWindow;
    fontFinder.loadDetective();
    var subFonts = this._findFontParts(curWin.document.getElementsByTagName("body")[0],new Array(0));
    return this.arrayUnique(subFonts);
  };
  
  this._findFontParts = function(element,curStack){
    var parts = new Array();
    if(typeof(element.style) != "undefined"){
      //var detective = new this.Detector()
      var fonts = this.getStyle(element,'font-family').split(',');
      fontLoop:for (var i=0; i < fonts.length; i++) {
        fonts[i] = this._cleanFontName(fonts[i]);
        if(curStack.indexOf(fonts[i]) > -1){
          break fontLoop;
        } else {
          if(fontFinder.detective.test(fonts[i])) {
            if(fonts[i] != 'ms shell dlg'){
              parts[parts.length] = fonts[i];
            }
            break fontLoop;
          }
        }
      };
      for(var i=0;i < element.childNodes.length; i++){
        parts = parts.concat(this._findFontParts(element.childNodes[i],parts));
      }
    }
    return parts;
  }

  //Replace the font across the entire DOM
  this.replaceFont = function(oldFont)
  {
    var newFont = prompt('Select new font to replace '+oldFont);
    if(newFont == false){
      return false;
    }
    var curWin = document.commandDispatcher.focusedWindow;
    newFont = this._cleanFontName(newFont);
    fontFinder.loadDetective();
    this._replaceFont(curWin.document.getElementsByTagName("body")[0],oldFont,newFont);
    fontFinder.namespace.analyzedFonts = false;
  };
  //Helper iterative function for replacing fonts across the entire DOM
  this._replaceFont = function(element,oldFont,newFont){
    var shift = 0;
    //Only analyze elements that could have a style
    if(typeof(element.style) != "undefined"){
      var curFonts = this.getStyle(element,'font-family').split(',');
      var resetFont = false;
      //Only handle elements where the font disabled is the one currently rendered
      fontLoop:for (var i=0; i < curFonts.length; i++) {
        if(fontFinder.detective.test(curFonts[i])) {
          if(fontFinder._cleanFontName(curFonts[i]) == oldFont){
            resetFont = true;
          }
          break fontLoop;
        }
      };
      if(resetFont == true){
        element.style.fontFamily = newFont;
      }
    }
    for(var i=0;i < element.childNodes.length; i++){
      shift += this._replaceFont(element.childNodes[i],oldFont,newFont);
    }
    return shift;
  }
  
  //Delete the font across the entire DOM
  this.disableFont = function(font)
  {
    var curWin = document.commandDispatcher.focusedWindow;
    fontFinder.loadDetective();
    this._disableFont(curWin.document.getElementsByTagName("body")[0],font);
    fontFinder.namespace.analyzedFonts = false;
  };
  //Helper iterative function for deleting fonts across the entire DOM
  this._disableFont = function(element,font){
    var shift = 0;
    //Only analyze elements that could have a style
    if(typeof(element.style) != "undefined"){
      var curFonts = this.getStyle(element,'font-family').split(',');
      var resetFont = false;
      //Only handle elements where the font disabled is the one currently rendered
      fontLoop:for (var i=0; i < curFonts.length; i++) {
        if(fontFinder.detective.test(curFonts[i])) {
          if(fontFinder._cleanFontName(curFonts[i]) == font){
            resetFont = true;
          }
          break fontLoop;
        }
      };
      if(resetFont == true){
        var parts = new Array();
        for(var j=0;j < curFonts.length; j++){
          if(this._cleanFontName(curFonts[j]) != font){
            parts[parts.length] = curFonts[j];
          }
        }
        shift++;
        if(parts.length > 0){
          element.style.fontFamily = parts.join(',');
        } else {
          element.style.fontFamily = 'inherit';
        }
      }
    }
    for(var i=0;i < element.childNodes.length; i++){
      shift += this._disableFont(element.childNodes[i],font);
    }
    return shift;
  }

  //Helper functions that're used to analyze pieces of the elements
  this.getStyle = function(element,style)
  {
    return content.document.defaultView.getComputedStyle(element,null).getPropertyValue(style);
  };

  this.RGBtoHex = function(R,G,B) 
  {
    return this.toHex(R)+this.toHex(G)+this.toHex(B)
  }

  this.toHex = function(N) 
  {
    if (N==null)
      return "XX";
    N=parseInt(N); 
    if (N==0 || isNaN(N))
      return "00";
    N=Math.max(0,N); N=Math.min(N,255); N=Math.round(N);
    return "0123456789ABCDEF".charAt((N-N%16)/16) + "0123456789ABCDEF".charAt(N%16);
  };

  this.removeSpaces = function(string) 
  {
    var tstring = "";
    string = '' + string;
    var splitstring = string.split(" ");
    for(var i = 0; i < splitstring.length; i++)
      tstring += splitstring[i];
    return tstring;
  };

  this.getColor = function(string)
  {
    string = string.substring(4);
    var stringLength = string.length - 1;
    string = string.substring(0,stringLength);
    string = this.removeSpaces(string);
    string = string.split(',');
    string = this.RGBtoHex(string[0],string[1],string[2])
    return string;
  };

  this.roundTwoPlaces = function(string)
  {
    return Math.round(string*100)/100;
  };

  this.removePX = function(string)
  {
    return string.substring(0,string.length - 2);
  };

  this.roundAndRemove = function(string)
  {
    return this.roundTwoPlaces(this.removePX(string));
  };

  //When requested, send data to the clipboard
  this.setClipboard = function(key,type,gotElement)
  {
    if(!gotElement){
      var analyzeSelect = this.analyzeSelection(true);
      if(analyzeSelect == false){
        return;
      } else if(analyzeSelect == -1){
        //The first time the left-click after-event system is used, explain how it is used. 
        if(fontFinder.prefManager.getBoolPref("extensions.fontfinder@bendodson.com.analyzeLeftClick") == false){
          alert("[Note: This message will appear only once.]\n\nYou must now left-click on any element of this page to complete this action.");
          fontFinder.prefManager.setBoolPref("extensions.fontfinder@bendodson.com.analyzeLeftClick",true);
        }
        // Toggle the event listener and the icon's appearance
        var curWin = document.commandDispatcher.focusedWindow;
        fontFinder.namespace.key = key;
        fontFinder.namespace.label = label;
        gBrowser.addEventListener("click", fontFinder.clipBoardListener, true);
        gBrowser.addEventListener("focus", fontFinder.doNothing, true);
        curWin.document.getElementsByTagName("body")[0].style.cursor = 'crosshair';
        return;
      }
    }

    if(fontFinder.namespace[key] == 'Not Applicable' || fontFinder.namespace[key] == 'undefined'){
      alert(type + " has no data that can be copied to the clipboard");
      return;
    }
    const gClipboardHelper = Components.classes["@mozilla.org/widget/clipboardhelper;1"].  
    getService(Components.interfaces.nsIClipboardHelper);  
    gClipboardHelper.copyString(fontFinder.namespace[key]);
    if(type != 'allInfo'){
      alert(type+' ('+fontFinder.namespace[key]+') copied to clipboard');
    } else {
      alert("All analyzed information copied to clipboard");
    }
    return;
  };

  //Track the clipboard left-click
  this.clipBoardListener = function(e)
  {
    // Don't follow links
    fontFinder.doNothing(e);

    // Remove the event listener and set the icon back to "off"
    var curWin = document.commandDispatcher.focusedWindow;
    curWin.document.getElementsByTagName("body")[0].style.cursor = '';
    gBrowser.removeEventListener("click", fontFinder.clipBoardListener, true);
    gBrowser.removeEventListener("focus", fontFinder.doNothing, true);
    
    fontFinder.namespace.elementName = e.target.nodeName.toLowerCase();
    fontFinder.namespace.elementID = e.target.id;
    fontFinder.namespace.elementClass = e.target.className;
    fontFinder.evaluator(e.target, true);
    fontFinder.setClipboard(fontFinder.namespace.key,fontFinder.namespace.label,e.target); 
  };

  /* Read-in the preferences to know if we should show the statusbar or context menu */
  this.onLoad = function()
  {
    this.loaded = true;
    /* Toggle whether the statusbar icon is displayed */
    if(!fontFinder.prefManager.getBoolPref("extensions.fontfinder@bendodson.com.statusbar"))
    {
      document.getElementById('fontfinder_statusbar_outer').style.display = 'none';
    } else {
      var e = document.getElementById("disable-font-options");
      if(e)
      {
        e.addEventListener("popupshowing", fontFinder.showContextMenu, false);
      }
      e = document.getElementById("replace-font-options");
      if(e)
      {
        e.addEventListener("popupshowing", fontFinder.showContextMenu, false);
      }
    }

    /* Toggle whether the context-menu is displayed */
    if(!fontFinder.prefManager.getBoolPref("extensions.fontfinder@bendodson.com.contextmenu"))
    {
      document.getElementById('fontfinder-menu').style.display = 'none';
    } else {
      var e = document.getElementById("disable-font-options-context");
      if(e)
      {
        e.addEventListener("popupshowing", fontFinder.showContextMenu, false);
      }
      e = document.getElementById("replace-font-options-context");
      if(e)
      {
        e.addEventListener("popupshowing", fontFinder.showContextMenu, false);
      }
    }
    
    /* Attach a listener to find out if any of our options get changed */
    var fontFinderListener = new FontFinderPrefListener("extensions.fontfinder@bendodson.com.",
      function(branch, name) {
        fontFinder.update(name);
      }
    );
    fontFinderListener.register();
  };
  
  //Create the detective only once, so we aren't needlessly re-creating the DOM sizes
  this.loadDetective = function(){
    if(fontFinder.detective == false){
      fontFinder.detective = new fontFinder.Detector();
    }
    return;
  };

  /* When the context menu is shown, determine what data to display */
  this.showContextMenu = function(event)
  {
    fontFinder.populateFonts();
  };
  
  this.reset = function()
  {
    if(fontFinder.loaded == false){
      fontFinder.onLoad();
    }
    fontFinder.namespace = new Object;
    fontFinder.namespace.analyzedFonts = false;
    fontFinder.copiers = [
      "hex",
      "font-family",
      "font-size",
      "id",
      "class",
      "all"
    ];
  };
}).apply(fontFinder);
window.addEventListener("load", function () {
  //Whenever a new page is loaded, reset the analyzed fonts
  gBrowser.addEventListener("load", fontFinder.reset, true);

  //Reset the stored data whenever the tab is changed
  gBrowser.tabContainer.addEventListener("TabSelect", fontFinder.reset, true);
  gBrowser.tabContainer.addEventListener("TabOpen", fontFinder.reset, true);
  
  //Welcome page
  (function() {
    //Detect Firefox version
    var version = "";
    try {
      version = (navigator.userAgent.match(/Firefox\/([\d\.]*)/) || navigator.userAgent.match(/Thunderbird\/([\d\.]*)/))[1];
    } catch (e) {}

    function welcome (version) {
      if(fontFinder.prefManager.getCharPref("extensions.fontfinder@bendodson.com.currentVersion") == version)
        return;
      //Showing welcome screen
      setTimeout(function() {
        var newTab = getBrowser().addTab("http://add0n.com/font-finder.html?version=" + version);
        getBrowser().selectedTab = newTab;
      }, 5000);
      fontFinder.prefManager.setCharPref("extensions.fontfinder@bendodson.com.currentVersion", version);
    }
    
    //FF < 4.*
    var versionComparator = Components.classes["@mozilla.org/xpcom/version-comparator;1"]
      .getService(Components.interfaces.nsIVersionComparator)
      .compare(version, "4.0");
    if (versionComparator < 0) {
      var extMan = Components.classes["@mozilla.org/extensions/manager;1"].getService(Components.interfaces.nsIExtensionManager);
      var addon = extMan.getItemForID("fontfinder@bendodson.com");
      welcome(addon.version);
    }
    //FF > 4.*
    else {
      Components.utils.import("resource://gre/modules/AddonManager.jsm");
      AddonManager.getAddonByID("fontfinder@bendodson.com", function(addon) {
        welcome(addon.version);
      });
    }
  })();
}, false);

/* Allow tracking on if any preferences are changed */
function FontFinderPrefListener(branchName, func)
{
  var prefService = Components.classes["@mozilla.org/preferences-service;1"]
                .getService(Components.interfaces.nsIPrefService);
  var branch = prefService.getBranch(branchName);
  branch.QueryInterface(Components.interfaces.nsIPrefBranch2);

  this.register = function()
  {
    branch.addObserver("", this, false);
    branch.getChildList("", { })
        .forEach(function (name) { func(branch, name); });
  };

  this.unregister = function unregister()
  {
    if (branch)
      branch.removeObserver("", this);
  };

  this.observe = function(subject, topic, data)
  {
    if (topic == "nsPref:changed")
      func(branch, data);
  };
}