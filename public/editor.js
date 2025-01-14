// DisplayGenerator main Javascript code
// Repository: https://github.com/rickkas7/DisplayGenerator
// License: MIT

// @ts-ignore
import debounce from 'https://cdn.jsdelivr.net/npm/lodash-es@4.17.21/debounce.js';
import defaultState from "./default-state.js"

if (!localStorage.savedEditorState) {
	localStorage.savedEditorState = defaultState;
}

// TODO: drag all the plugin code outta here (implement each object hit-test, render, code-gen separately)

var screenx = 128;
var screeny = 64;
var zoom = 4;
var margin = 8;
var showMini = true;
var miniMargin = 4;
var miniSeparator = 10;
var yellowTopSize = 16;
var displayWhite = '#e2fdff';
var displayBlack = "#111833";
var displayYellow = '#fdf020';
var displayBlue = '#4bd3ff';

var gfx;
var mainApp;
var iconApp;
var selectedCmd;

function go() {
	// Create an Adafruit GFX 1-bit deep bitmap of screenx x screeny pixels
	// Note: when using the short display the GFX screen size is still set at
	// 128x64, it's just the bottom half isn't rendered to the screen.
	gfx = new Module['TestGFX'](screenx, screeny);
	window['main'] = Module;
	initializeVue();
}

// Only one of these should fire.
Module.onRuntimeInitialized = function() { go(); }
if (Module['TestGFX']) { go(); }

function initializeVue() {

	var fontArray = [];
	var fontVector = gfx.getFonts();

	fontArray.push("Default")
	for(var ii = 0; ii < fontVector.size(); ii++) {
		var name = fontVector.get(ii);
		fontArray.push(name);
	}

	const toolPlugins = {
		"select": {
			shortcut: 'V',
			findTopObjectAt: function(objects, coords) {
				let [x,y] = coords;
				return objects.slice().reverse().find(o => {
					return (
						o.x <= x && 
						o.y <= y && 
						o.x + o.w > x &&
						o.y + o.h > y
					);
				});
			},
			hover: function(app, data) {
			},
			mousedown: function(app, { coords, event }) {
				let obj = toolPlugins.select.findTopObjectAt(app.objects, coords);
				app.selectObject(obj, event);
			},
			dragStart: function(app, {event}) {
				if (event.altKey || event.metaKey) {
					app.duplicateSelection();
				}
			},
			drag: function(app, data) {
				var delta = [
					data.coords[0] - data.lastCoords[0],
					data.coords[1] - data.lastCoords[1]
				];
				app.selectedObjects.forEach(selectedObject => {
					selectedObject.x += delta[0];
					selectedObject.y += delta[1];
				});
				updateOutput();
			}
		},
		"rect": {
			shortcut: 'R',
			currentRect: null,
			mousedown: function(app, data) {
				toolPlugins.rect.currentRect = {
					id: app.nextId++,
					type: "rect",
					x: data.coords[0],
					y: data.coords[1],
					w: 1,
					h: 1,
					strokeColor: 1,
					fillColor: null
				};
				app.objects.push(toolPlugins.rect.currentRect);
				app.selectedObject = toolPlugins.rect.currentRect;
				updateOutput();
			},
			drag: function(app, data) {
				let currentRect = toolPlugins.rect.currentRect;
				currentRect.w = data.coords[0] - currentRect.x + 1;
				currentRect.h = data.coords[1] - currentRect.y + 1;
				updateOutput();
			},
			mouseup: function(app, data) {
				app.selectedObject = toolPlugins.rect.currentRect;
				toolPlugins.rect.currentRect = null;
				updateOutput();
			},
		},
		"text": {
			mousedown: function(app, data) {
				const newText = {
					id: app.nextId++,
					type: "text",
					text: prompt("Text", "Hello"),
					x: data.coords[0],
					y: data.coords[1],
				};
				app.canvasMouseIsDown = false; // TODO: hack because of prompt()
				app.canvasDragging = false; // TODO: hack because of prompt()

				// TODO: make these computed values somehow
				newText.w = 6 * newText.text.length - 1;
				newText.h = 7;
				app.objects.push(newText);
				app.selectedObject = newText;
				app.currentTool = "select"; // TODO: is this good? if so, consider how to do it properly
				updateOutput();
			}
		}
	}

	mainApp = new Vue({
		el: '#mainApp',
		mounted: function() {
			requestAnimationFrame(() => {
				this.updateCanvas();
			});
			window.addEventListener('mouseup', (event) => {
				this.toolEvent('mouseup', { event }); // no coords outside of canvas
			});
			window.addEventListener('keydown', (e) => {
				if (window['__keycodes']) console.log(`${e.code} (${e.key})`);

				switch(e.code) {
				case "Delete":
				case "Backspace": 
					this.deleteObjects(this.selectedObjects);
					break;

				case "BracketLeft":
					if (e.shiftKey) {
						this.moveToBack(this.selectedObjects);
					} else {
						this.moveBack(this.selectedObjects);
					}
					break;
				case "BracketRight":
					if (e.shiftKey) {
						this.moveToFront(this.selectedObjects);
					} else {
						this.moveForward(this.selectedObjects);
					}
					break;
				}

				Object.entries(toolPlugins).forEach(([pluginName, {shortcut}]) => {
					if (e.code === `Key${shortcut}`) {
						this.currentTool = pluginName
					}
				});

			});
			try {
				if (localStorage.savedEditorState) {
					const savedState = JSON.parse(localStorage.savedEditorState);
					this.objects = savedState.objects;
					this.nextId = savedState.nextId;

					if (this.tools.includes(savedState.currentTool)) {
						this.currentTool = savedState.currentTool;
					}
				}
			} catch(e) {
				console.error("Failed to revive.", e)
			}
		},
		computed: {
			selectedObject: {
				get: function() {
					console.warn("getting selectedObject...");
					return this.selectedObjects[0];
				},
				set: function(val) {
					this.selectedObjects = val ? [val] : [];
				}
			}
		},
		data: {
			constructionLines: true,
			showSelection: true,
			tools: Object.keys(toolPlugins),
			currentTool: "rect",
			canvasDragging: false,
			canvasMouseIsDown: false,
			objects: [],
			selectedObjects: [],
			hoveredObject: null,
			commands: [],
			fonts: fontArray,
			commandNames: [
				'writePixel', 'drawLine','drawRect','fillRect','drawRoundRect','fillRoundRect',
				'drawCircle','fillCircle', 'drawTriangle','fillTriangle',
				'setCursor', 'setTextColor', 'setTextSize', 'setTextWrap', 'setFont', 
				'print','println','printCentered',
				'drawIcon'],
			commandDefaults: {
				writePixel:{x:"0", y:"0", color:"1"},
				drawLine:{x0:"0", y0:"0", x1:"10", y1:"10", color:"1"},
				drawRect:{x:"0", y:"0", w:"10", h:"10", color:"1"},
				fillRect:{x:"0", y:"0", w:"10", h:"10", color:"1"},
				drawRoundRect:{x:"0", y:"0", w:"10", h:"10", r:"3", color:"1"},
				fillRoundRect:{x:"0", y:"0", w:"10", h:"10", r:"3", color:"1"},
				drawCircle:{x:"10", y:"10", r:"10", color:"1"},
				fillCircle:{x:"10", y:"10", r:"10", color:"1"},
				drawTriangle:{x0:"0", y0:"0", x1:"20", y1:"0", x2:"10", y2:"10", color:"1"},
				fillTriangle:{x0:"0", y0:"0", x1:"20", y1:"0", x2:"10", y2:"10", color:"1"},
				setCursor:{x:"0", y:"10"},
				setTextColor:{invert:0},
				setTextSize:{size:"1"},
				setTextWrap:{w:"1"},
				setFont:{font:"Default"},
				print:{text:"HELLO"},
				println:{text:"HELLO"},
				printCentered:{text:"HELLO"},
				drawIcon:{x:"0", y:"0", size:"24", width:"24", height:"24", color:"1", bitmap:""}
			},
			nextId:6,
			codeText:'',
			selectedCommandId:-1,
			placeIntoDocument: false, // If true, insert loaded data into existing document. Otherwise replace.
			displayType:'normal',
			invertDisplay:false
		},
		methods: {
			clearDocument: function() {
				if (confirm("Delete everything? No undo.")) {
					this.deleteObjects(this.objects);
				}
			},
			duplicateSelection: function() {
				this.selectedObjects = this.selectedObjects.map(o => ({...o, id: this.nextId++}));
				this.objects.push(...this.selectedObjects);
			},
			deleteObjects: function(objs) {
				this.objects = this.objects.filter(o => !objs.includes(o));
				this.selectedObjects = this.selectedObjects.filter(o => !objs.includes(o));
				if (objs.includes(this.hoveredObject)) {
					this.hoverObject(null);
				}
				updateOutput();
			},
			selectObject(obj, event) {
				const toggle = event.shiftKey;
				if (toggle) {
					if (obj) {
						if (this.selectedObjects.includes(obj)) {
							this.selectedObjects = this.selectedObjects.filter(o => o !== obj);
							updateOutput();
						} else {
							this.selectedObjects.push(obj);
							updateOutput();
						}
					} else {
						// ¯\_(ツ)_/¯
					}
				} else {
					if (obj) {
						if (!this.selectedObjects.includes(obj)) {
							this.selectedObject = this.objects.find(v => v == obj);
							updateOutput();
						}
					} else {
						this.selectedObject = null;
						updateOutput();
					}
				}
			},
			hoverObject(obj) {
				this.hoveredObject = obj;
				render();
			},
			moveBack: function(objs) {
				// Moving a potentially discontiguous set of objects might be 
				// tricky and cause unexpected results. So we're just going to
				// insert them all in one clump behind the object below the 
				// lowest in `objs`.

				// Calc list of tuples with obj and its original docIndex, 
				// ordered by that index. (Low index at [0].)
				let objStack = objs.map(obj => ({
					obj,
					docIndex: this.objects.findIndex(o => o === obj)
				})).sort((a,b) => a.docIndex - b.docIndex);
				
				console.log(objStack);

				if (objStack[0].docIndex == 0) {
					// bottom of group is already at bottom.
					// we'll just make sure it's contiguous and stick it all at the bottom.
					const cattle = this.objects.filter(o => !objs.includes(o));
					const pets = objStack.map(info => info.obj);
					console.log("bump", pets, cattle);
					this.objects = [...pets, ...cattle];
				} else {
					// clump em together below the element with the lowest docIndex
					const insertBelowTargetObject = this.objects[objStack[0].docIndex - 1];

					const cattle = this.objects.filter(o => !objs.includes(o));
					// Split the cattle so the pets can fit in the middle
					const targetObjectCattleIndex = cattle.findIndex(o => o === insertBelowTargetObject);
					const low  = cattle.slice(0, targetObjectCattleIndex);
					const high = cattle.slice(targetObjectCattleIndex);

					const pets = objStack.map(info => info.obj);

					console.log("slough", low, pets, high);
					
					this.objects = [...low, ...pets, ...high];
					
					// :sweatsmile:
				}
				updateOutput();
			},
			moveForward: function(objs) {

			},
			moveToBack: function(objs) {
				console.log("back", objs);
				this.objects = this.objects.filter(o => !objs.includes(o));
				this.objects.unshift(...objs);
				updateOutput();
			},
			moveToFront: function(objs) {
				console.log("front", objs);
				this.objects = this.objects.filter(o => !objs.includes(o));
				this.objects.push(...objs);
				updateOutput();
			},
			clickTool: function(toolname) {
				this.currentTool = toolname;
			},
			updateCanvas: function() {
				let mainCanvas = /** @type {HTMLCanvasElement} */
					(document.getElementById('mainCanvas'));

				mainCanvas.width = window.devicePixelRatio * totalWidth();
				mainCanvas.style.width = `${totalWidth()}px`;

				mainCanvas.height = window.devicePixelRatio * mainCanvasHeight();
				mainCanvas.style.height = `${mainCanvasHeight()}px`;

				updateOutput();
			},
			uploadCommand: function(event) {
				var files = event.target.files;

				if (files.length == 1) {
					// https://www.html5rocks.com/en/tutorials/file/dndfiles/
					var reader = new FileReader();

					// Closure to capture the file information.
					reader.onload = (function(files) {
						return function(e) {
							console.log("result", e.target.result);
							try {
								var json = JSON.parse(e.target.result);
								
								if (mainApp.placeIntoDocument) {
									for(var ii = 0; ii < json.length; ii++) {
										json[ii].id = mainApp.nextId++;
										mainApp.commands.push(json[ii]);										
									}
								}
								else {
									mainApp.commands = json;
								}
								updateOutput();
							}
							catch(e) {

							}
						};
					})(files[0]);

					// Read in the image file as a data URL.
					reader.readAsText(files[0]);
				}
			},
			downloadCommand: function() {
				// https://stackoverflow.com/questions/13405129/javascript-create-and-save-file
				var filename = 'layout.json';
				var file = new Blob([JSON.stringify(mainApp.commands, null, 2)], {type: "text/json"});
				if (window.navigator.msSaveOrOpenBlob) // IE10+
					window.navigator.msSaveOrOpenBlob(file, filename);
				else { // Others
					var a = document.createElement("a");
					var url = URL.createObjectURL(file);
					a.href = url;
					a.download = filename;
					document.body.appendChild(a);
					a.click();
					setTimeout(function() {
						document.body.removeChild(a);
						window.URL.revokeObjectURL(url);  
					}, 0); 
				}
			},
			copyCodeCommand: function() {
				var copyText = /** @type {HTMLTextAreaElement} */
					(document.getElementById("codeTextArea"));
				copyText.select();
				document.execCommand("copy");	
			},
			saveCodeCommand: function() {
				var filename = 'code.cpp';
				var file = new Blob([this.codeText], {type: "text/plain"});
				if (window.navigator.msSaveOrOpenBlob) // IE10+
					window.navigator.msSaveOrOpenBlob(file, filename);
				else { // Others
					var a = document.createElement("a");
					var url = URL.createObjectURL(file);
					a.href = url;
					a.download = filename;
					document.body.appendChild(a);
					a.click();
					setTimeout(function() {
						document.body.removeChild(a);
						window.URL.revokeObjectURL(url);  
					}, 0); 
				}
			},
			getEventCoords(event) {
				var rect = event.target.getBoundingClientRect();
				var x = event.clientX - rect.left;
				var y = event.clientY - rect.top;

				var cx = Math.floor((x - margin) / zoom);
				if (cx < 0) {
					cx = 0;
				}
				if (cx > screenx) {
					cx = screenx;
				}
				var cy = Math.floor((y - margin) / zoom);
				if (cy < 0) {
					cy = 0;
				}
				if (cy > screeny) {
					cy = screeny;
				}

				return [cx,cy];
			},
			toolEvent: function(eventName, data) {
				const currentToolPlugin = toolPlugins[this.currentTool];
				if (currentToolPlugin[eventName]) { 
					currentToolPlugin[eventName](this, data);
				}
			},
			canvasMove: function(event) {
				let coords = this.getEventCoords(event);
				if (this.canvasMouseIsDown) {
					if (!this.canvasDragging) {
						this.canvasDragging = true;
						this.toolEvent('dragStart', { 
							coords, event,
							lastCoords: this.lastDragCoords
						});
					}
					this.toolEvent('drag', { 
						coords, event,
						lastCoords: this.lastDragCoords
					});
					this.lastDragCoords = coords;
				} else {
					this.toolEvent('hover', { coords, event });
				}
			},
			canvasMouseDown: function(event) {
				let coords = this.getEventCoords(event);
				this.canvasMouseIsDown = true;
				this.toolEvent('mousedown', { coords, event });
				this.lastDragCoords = coords;
			},
			canvasMouseUp: /** @param {MouseEvent} event */ function(event) {
				let coords = this.getEventCoords(event);
				this.canvasMouseIsDown = false;
				this.canvasDragging = false;

				event.stopImmediatePropagation();

				this.toolEvent('mouseup', { coords, event });

				// this.objects.push({
				// 	id: this.nextId++,
				// 	type: "rect",
				// 	x: coords[0],
				// 	y: coords[1],
				// 	w: 20,
				// 	h: 5,
				// 	strokeColor: 1,
				// 	fillColor: null
				// });
				
				// updateOutput();
			}
		},
		watch: {
			showSelection: {
				handler() {
					render();
				}
			},
			constructionLines: {
				handler() {
					render();
				}
			},
			selectedCommandId: {
				handler(val) {
					// Update global variable, used by icon app
					selectedCmd = findCommandById(val);
					if (selectedCmd && selectedCmd.op === 'drawIcon') {
						document.getElementById('iconApp').style.display = 'block';
					}
					else {
						document.getElementById('iconApp').style.display = 'none';					
					}
					if (iconApp.showCode || !selectedCmd || selectedCmd.op !== 'drawIcon') {						
						document.getElementById('codeOutput').style.display = 'block';					
					}
					else {
						document.getElementById('codeOutput').style.display = 'none';											
					}
				}
			},
			displayType: {
				handler(val) {
					if (val === 'short') {
						// 128x32
						screeny = 32;
					}
					else {
						// 128x64
						screeny = 64;
					}

					this.updateCanvas();
					
					updateOutput();
				}
			},
			invertDisplay: {
				handler(val) {
					updateOutput();
				}
			}
		}
	});

	window['mainApp'] = mainApp;

	Vue.component('iconRow', {
		props: ['name','iconNames'],
		template: `
			<tr v-on:click="selectIcon">
			<td><img :src="path" width="24" height="24" :id="imgId"/></td>
			<td>{{name}}</td>
			</tr>
			`,
			computed: {
				path: function() {
					return 'feather/' + this.name + '.svg';
				},
				imgId: function() {
					return 'img' + this.name;
				}
			},
			methods: {
				selectIcon: function(event) {
					iconApp.selectedIconName = this.name;
				}
			}
	});
	iconApp = new Vue({
		el: '#iconApp',
		data: {
			iconNames: [
				"activity",
				"airplay",
				"alert-circle",
				"alert-octagon",
				"alert-triangle",
				"align-center",
				"align-justify",
				"align-left",
				"align-right",
				"anchor",
				"aperture",
				"archive",
				"arrow-down-circle",
				"arrow-down-left",
				"arrow-down-right",
				"arrow-down",
				"arrow-left-circle",
				"arrow-left",
				"arrow-right-circle",
				"arrow-right",
				"arrow-up-circle",
				"arrow-up-left",
				"arrow-up-right",
				"arrow-up",
				"at-sign",
				"award",
				"bar-chart-2",
				"bar-chart",
				"battery-charging",
				"battery",
				"bell-off",
				"bell",
				"bluetooth",
				"bold",
				"book-open",
				"book",
				"bookmark",
				"box",
				"briefcase",
				"calendar",
				"camera-off",
				"camera",
				"cast",
				"check-circle",
				"check-square",
				"check",
				"chevron-down",
				"chevron-left",
				"chevron-right",
				"chevron-up",
				"chevrons-down",
				"chevrons-left",
				"chevrons-right",
				"chevrons-up",
				"chrome",
				"circle",
				"clipboard",
				"clock",
				"cloud-drizzle",
				"cloud-lightning",
				"cloud-off",
				"cloud-rain",
				"cloud-snow",
				"cloud",
				"code",
				"codepen",
				"codesandbox",
				"coffee",
				"columns",
				"command",
				"compass",
				"copy",
				"corner-down-left",
				"corner-down-right",
				"corner-left-down",
				"corner-left-up",
				"corner-right-down",
				"corner-right-up",
				"corner-up-left",
				"corner-up-right",
				"cpu",
				"credit-card",
				"crop",
				"crosshair",
				"database",
				"delete",
				"disc",
				"dollar-sign",
				"download-cloud",
				"download",
				"droplet",
				"edit-2",
				"edit-3",
				"edit",
				"external-link",
				"eye-off",
				"eye",
				"facebook",
				"fast-forward",
				"feather",
				"figma",
				"file-minus",
				"file-plus",
				"file-text",
				"file",
				"film",
				"filter",
				"flag",
				"folder-minus",
				"folder-plus",
				"folder",
				"framer",
				"frown",
				"gift",
				"git-branch",
				"git-commit",
				"git-merge",
				"git-pull-request",
				"github",
				"gitlab",
				"globe",
				"grid",
				"hard-drive",
				"hash",
				"headphones",
				"heart",
				"help-circle",
				"hexagon",
				"home",
				"image",
				"inbox",
				"info",
				"instagram",
				"italic",
				"key",
				"layers",
				"layout",
				"life-buoy",
				"link-2",
				"link",
				"linkedin",
				"list",
				"loader",
				"lock",
				"log-in",
				"log-out",
				"mail",
				"map-pin",
				"map",
				"maximize-2",
				"maximize",
				"meh",
				"menu",
				"message-circle",
				"message-square",
				"mic-off",
				"mic",
				"minimize-2",
				"minimize",
				"minus-circle",
				"minus-square",
				"minus",
				"monitor",
				"moon",
				"more-horizontal",
				"more-vertical",
				"mouse-pointer",
				"move",
				"music",
				"navigation-2",
				"navigation",
				"octagon",
				"package",
				"paperclip",
				"pause-circle",
				"pause",
				"pen-tool",
				"percent",
				"phone-call",
				"phone-forwarded",
				"phone-incoming",
				"phone-missed",
				"phone-off",
				"phone-outgoing",
				"phone",
				"pie-chart",
				"play-circle",
				"play",
				"plus-circle",
				"plus-square",
				"plus",
				"pocket",
				"power",
				"printer",
				"radio",
				"refresh-ccw",
				"refresh-cw",
				"repeat",
				"rewind",
				"rotate-ccw",
				"rotate-cw",
				"rss",
				"save",
				"scissors",
				"search",
				"send",
				"server",
				"settings",
				"share-2",
				"share",
				"shield-off",
				"shield",
				"shopping-bag",
				"shopping-cart",
				"shuffle",
				"sidebar",
				"skip-back",
				"skip-forward",
				"slack",
				"slash",
				"sliders",
				"smartphone",
				"smile",
				"speaker",
				"square",
				"star",
				"stop-circle",
				"sun",
				"sunrise",
				"sunset",
				"tablet",
				"tag",
				"target",
				"terminal",
				"thermometer",
				"thumbs-down",
				"thumbs-up",
				"toggle-left",
				"toggle-right",
				"trash-2",
				"trash",
				"trello",
				"trending-down",
				"trending-up",
				"triangle",
				"truck",
				"tv",
				"twitter",
				"type",
				"umbrella",
				"underline",
				"unlock",
				"upload-cloud",
				"upload",
				"user-check",
				"user-minus",
				"user-plus",
				"user-x",
				"user",
				"users",
				"video-off",
				"video",
				"voicemail",
				"volume-1",
				"volume-2",
				"volume-x",
				"volume",
				"watch",
				"wifi-off",
				"wifi",
				"wind",
				"x-circle",
				"x-octagon",
				"x-square",
				"x",
				"youtube",
				"zap-off",
				"zap",
				"zoom-in",
				"zoom-out"
				],
				square: true,
				size: "24",
				width: "24",
				height: "24",
				weight: "64",
				selectedIconName: "",
				search: "alert",
				hex: "",
				showCode: false,
				standardLogoSelect: ""
		},
		watch: {
			square: "updateIcon",
			size: "updateIcon",
			width: "updateIcon",
			height: "updateIcon",
			weight: "updateIcon",
			selectedIconName: "updateIcon",
			showCode: function() {
				if (this.showCode) {						
					document.getElementById('codeOutput').style.display = 'block';					
				}
				else {
					document.getElementById('codeOutput').style.display = 'none';											
				}
			},
			standardLogoSelect: "updateIcon"
		},
		computed: {
			filteredIconNames: function() {
				var search = this.search;

				return this.iconNames.filter(function(name) {
					if (search != '') {
						return (name.indexOf(search) >= 0);
					}
					else {
						// Return all
						return true;
					}
				})
			}
		},
		methods: {			
			searchAll: function() {
				this.search = '';
			},
			uploadIconCommand: function(event) {
				var files = event.target.files;
				// console.log("files", files);

				if (files.length == 1) {
					// https://www.html5rocks.com/en/tutorials/file/dndfiles/
					var reader = new FileReader();

					// Closure to capture the file information.
					reader.onload = (function(files) {
						return function(e) {
							this.selectedIconName = '';
							
							var iconImg = /** @type {HTMLImageElement} */
								(document.getElementById('iconImg'));
							iconImg.style.display = 'block';
							iconImg.src = e.target.result;
							setTimeout(function() {
								iconApp.updateIconWithImg(iconImg);
							}, 100);
						};
					})(files[0]);

					// Clear any icon name
					this.selectedIconName = '';
					
					// Read in the image file as a data URL.
					reader.readAsDataURL(files[0]);
				}
			},
			updateIcon: function() {
				if (this.standardLogoSelect != '' && selectedCmd != undefined) {
					
					
					switch(this.standardLogoSelect) {
					case 'p128x32':
						selectedCmd.x = 0;
						selectedCmd.y = (screeny == 32) ? 0 : 16;
						selectedCmd.width = 128;
						selectedCmd.height = 32;
						selectedCmd.bitmap = particle128x32;
						break;
						
					case 'p32x32':
						selectedCmd.x = 48;
						selectedCmd.y = (screeny == 32) ? 0 : 16;
						selectedCmd.width = 32;
						selectedCmd.height = 32;
						selectedCmd.bitmap = particle32x32;
						break;

					case 'p48x48':
						selectedCmd.x = 40;
						selectedCmd.y = (screeny == 32) ? -8 : 8;
						selectedCmd.width = 48;
						selectedCmd.height = 48;
						selectedCmd.bitmap = particle48x48;
						break;

					case 'a82x64':
						selectedCmd.x = 23;
						selectedCmd.y = 0;
						selectedCmd.width = 82;
						selectedCmd.height = 64;
						selectedCmd.bitmap = adafruit82x64;
						break;
						
					case 'a115x32':
						selectedCmd.x = 6;
						selectedCmd.y = 0;
						selectedCmd.width = 115;
						selectedCmd.height = 32;
						selectedCmd.bitmap = adafruit115x32;
						break;
					}

				}
				else
				if (this.selectedIconName != '') {
					var img = document.getElementById('img' + this.selectedIconName);
					iconApp.updateIconWithImg(img);
				}
				else {
					var img = document.getElementById('iconImg');
					iconApp.updateIconWithImg(img);					
				}
			},			
			updateIconWithImg: function(img) {
				var width, height;
				
				if (this.square) {
					width = height = parseInt(this.size);
				}
				else {
					width = parseInt(this.width);
					height = parseInt(this.height);
				}
				// console.log("selectIcon " + this.selectedIconName + " size=" + size);

				var canvas = /** @type {HTMLCanvasElement} */
					(document.getElementById("iconCanvas"));

				var ctx = canvas.getContext("2d");
				ctx.clearRect(0, 0, canvas.width, canvas.height);

				if (width > 5 && width <= 128 && height > 5 && height <= 64) {
					ctx.drawImage(img, 0, 0, width, height);	

					var imageData = ctx.getImageData(0, 0, width, height);
					var pixels = imageData.data;

					var ii = 0;

					var bitmap = [];
					var byte = 0;
					var bitIndex = 7;

					var weight = parseInt(this.weight);

					for(var yy = 0; yy < height; yy++) {
						for(var xx = 0; xx < width; xx++) {
							var red = pixels[ii++];
							var green = pixels[ii++];
							var blue = pixels[ii++];
							var alpha = pixels[ii++];

							//console.log("xx=" + xx + " yy=" + yy + " red=" + red + " green=" + green + " blue=" + blue + " ii=" + ii);

							if ((red > 10 || green > 10 || blue > 10) || alpha >= weight) {
								// Pixel set
								byte |= (1 << bitIndex);
							}
							if (--bitIndex < 0) {
								bitmap.push(byte);
								byte = 0;
								bitIndex = 7;
							}
						}
						if (bitIndex != 7) {
							bitmap.push(byte);
							byte = 0;
							bitIndex = 7;							
						}
					}

					var hex = '';

					for(var ii = 0; ii < bitmap.length; ii++) {
						var value = bitmap[ii];
						if (value < 0x10) {
							hex += '0' + value.toString(16);
						}
						else {
							hex += value.toString(16);							
						}
					}
					// console.log("bitmap=" + hex);
					this.hex = hex;

					// Find last bitmap
					if (selectedCmd != undefined) {
						selectedCmd.width = width;
						selectedCmd.height = height;
						selectedCmd.bitmap = hex;
					}
				} 
			}
		}
	});


	updateOutput();
}

function findCommandById(id) {
	for(var ii = 0; ii < mainApp.commands.length; ii++) {
		var cmd = mainApp.commands[ii];
		if (cmd.id == id) {
			return cmd;
		}
	}
	return undefined;
}

function generateCommands() {
	const commands = [];

	mainApp.objects.forEach(o => {
		var {x,y,w,h,type} = o;
		switch (type) {
		case "rect":
			commands.push({
				op: "fillRect",
				color: 0,
				x,y,w,h
			});
			commands.push({
				op: "drawRect",
				color: 1,
				x,y,w,h
			});
			break;
		case "text":
			commands.push({
				op: "setTextWrap",
				w: 0
			});
			commands.push({
				op: "setCursor",
				x,y
			});
			commands.push({
				op: "print",
				text: o.text,
			})
			break;
		}
	});

	return commands;
}

function nextAnimationFrame() {
	return new Promise(res => {
		requestAnimationFrame(() => res());
	})
}

var debouncedGenerateCode = debounce(() => {
	updateOutput(true);
}, 200, { leading: false, trailing: true });

async function updateOutput(heavy = false) {
	
	if (heavy) {
		console.log('Generating and saving...');
		localStorage.savedEditorState = JSON.stringify({
			objects: mainApp.objects,
			nextId: mainApp.nextId,
			currentTool: mainApp.currentTool,
		});
	}

	var commands = generateCommands();

	var codeIncl = '';
	var codeDecl = '';
	var codeImpl = 'void updateDisplay() {\n';

	var indent = '    ';
	var gfxClass = 'display.';

	codeImpl += indent + gfxClass + 'clearDisplay();\n';
	
	gfx.fillScreen(0);
	for(var ii = 0; ii < commands.length; ii++) {
		var cmd = commands[ii];
		
		switch(cmd.op) {
		case 'writePixel': 
			gfx.writePixel(parseInt(cmd.x), parseInt(cmd.y), parseInt(cmd.color));
			codeImpl += indent + gfxClass + 'writePixel(' + cmd.x + ', ' + cmd.y + ', ' + cmd.color + ');\n';
			break;

		case 'drawLine': 
			gfx.drawLine(parseInt(cmd.x0), parseInt(cmd.y0), parseInt(cmd.x1), parseInt(cmd.y1), parseInt(cmd.color));
			codeImpl += indent + gfxClass + 'drawLine(' + cmd.x0 + ', ' + cmd.y0 + ', ' + cmd.x1 + ', ' + cmd.y1 + ', ' + cmd.color + ');\n';
			break;
			
		case 'drawRect':
			gfx.drawRect(parseInt(cmd.x), parseInt(cmd.y), parseInt(cmd.w), parseInt(cmd.h), parseInt(cmd.color));
			codeImpl += indent + gfxClass + 'drawRect(' + cmd.x + ', ' + cmd.y+ ', ' + cmd.w + ', ' + cmd.h + ', ' + cmd.color + ');\n';
			break;
			
		case 'fillRect':
			gfx.fillRect(parseInt(cmd.x), parseInt(cmd.y), parseInt(cmd.w), parseInt(cmd.h), parseInt(cmd.color));
			codeImpl += indent + gfxClass + 'fillRect(' + cmd.x + ', ' + cmd.y+ ', ' + cmd.w + ', ' + cmd.h + ', ' + cmd.color + ');\n';
			break;
			
		case 'drawRoundRect':
			gfx.drawRoundRect(parseInt(cmd.x), parseInt(cmd.y), parseInt(cmd.w), parseInt(cmd.h), parseInt(cmd.r), parseInt(cmd.color));
			codeImpl += indent + gfxClass + 'drawRoundRect(' + cmd.x + ', ' + cmd.y+ ', ' + cmd.w + ', ' + cmd.h + ', ' + cmd.r + ', ' + cmd.color + ');\n';
			break;
		
		case 'fillRoundRect':
			gfx.fillRoundRect(parseInt(cmd.x), parseInt(cmd.y), parseInt(cmd.w), parseInt(cmd.h), parseInt(cmd.r), parseInt(cmd.color));
			codeImpl += indent + gfxClass + 'fillRoundRect(' + cmd.x + ', ' + cmd.y+ ', ' + cmd.w + ', ' + cmd.h + ', ' + cmd.r + ', ' + cmd.color + ');\n';
			break;
			
		case 'drawCircle':
			gfx.drawCircle(parseInt(cmd.x), parseInt(cmd.y), parseInt(cmd.r), parseInt(cmd.color));
			codeImpl += indent + gfxClass + 'drawCircle(' + cmd.x + ', ' + cmd.y + ', ' + cmd.r + ', ' + cmd.color + ');\n';
			break;
			
		case 'fillCircle':
			gfx.fillCircle(parseInt(cmd.x), parseInt(cmd.y), parseInt(cmd.r), parseInt(cmd.color));
			codeImpl += indent + gfxClass + 'fillCircle(' + cmd.x + ', ' + cmd.y + ', ' + cmd.r + ', ' + cmd.color + ');\n';
			break;
			
		case 'drawTriangle':
			gfx.drawTriangle(parseInt(cmd.x0), parseInt(cmd.y0), parseInt(cmd.x1), parseInt(cmd.y1), parseInt(cmd.x2), parseInt(cmd.y2), parseInt(cmd.color));
			codeImpl += indent + gfxClass + 'drawTriangle(' + cmd.x0 + ', ' + cmd.y0 + ', ' + cmd.x1 + ', ' + cmd.y1 + ', ' + cmd.x2 + ', ' + cmd.y2 + ', ' + cmd.color + ');\n';
			break;
			
		case 'fillTriangle':
			gfx.fillTriangle(parseInt(cmd.x0), parseInt(cmd.y0), parseInt(cmd.x1), parseInt(cmd.y1), parseInt(cmd.x2), parseInt(cmd.y2), parseInt(cmd.color));
			codeImpl += indent + gfxClass + 'fillTriangle(' + cmd.x0 + ', ' + cmd.y0 + ', ' + cmd.x1 + ', ' + cmd.y1 + ', ' + cmd.x2 + ', ' + cmd.y2 + ', ' + cmd.color + ');\n';
			break;
			
		case 'setCursor':
			gfx.setCursor(parseInt(cmd.x), parseInt(cmd.y));
			codeImpl += indent + gfxClass + 'setCursor(' + cmd.x + ', ' + cmd.y + ');\n';
			break;
			
		case 'setFont':
			gfx.setFontByName(cmd.font);
			if (cmd.font === 'Default') {
				codeImpl += indent + gfxClass + 'setFont(NULL);\n';				
			}
			else {
				codeIncl += '#include "' + cmd.font + '.h"\n';

				codeImpl += indent + gfxClass + 'setFont(&' + cmd.font + ');\n';								
			}
			break;
			
			
		case 'setTextColor':
			if (!cmd.invert) {
				gfx.setTextColor(1);
				codeImpl += indent + gfxClass + 'setTextColor(WHITE);\n';				
			}
			else {
				gfx.setTextColor2(0, 1);
				codeImpl += indent + gfxClass + 'setTextColor(BLACK, WHITE);\n';				
			}
			break;
			
		case 'setTextSize':
			gfx.setTextSize(parseInt(cmd.size));
			codeImpl += indent + gfxClass + 'setTextSize(' + cmd.size + ');\n';
			break;
			
		case 'setTextWrap':
			gfx.setTextWrap(parseInt(cmd.w));
			codeImpl += indent + gfxClass + 'setTextWrap(' + cmd.w + ');\n';
			break;
		
		case 'print':
			gfx.print(cmd.text);
			codeImpl += indent + gfxClass + 'print(' + quotedC(cmd.text) + ');\n';
			break;
		
		case 'println':
			gfx.println(cmd.text);
			codeImpl += indent + gfxClass + 'println(' + quotedC(cmd.text) + ');\n';
			break;
			
		case 'printCentered':
			{
				gfx.setTextWrap(0);
				codeImpl += indent + gfxClass + 'setTextWrap(0);\n';
	
				var cursorY = gfx.getCursorY();
				cmd.width = gfx.measureTextX(cmd.text);
				var cursorX = Math.floor((screenx / 2) - (cmd.width / 2));
								
				gfx.setCursor(cursorX, cursorY);
				codeImpl += indent + gfxClass + 'setCursor(' + cursorX + ', ' + cursorY + ');\n';

				gfx.println(cmd.text);
				codeImpl += indent + gfxClass + 'println(' + quotedC(cmd.text) + ');\n';
			}
			break;
																
		case 'drawIcon':
			if (cmd.bitmap != '' && parseInt(cmd.width) > 0 && parseInt(cmd.height) > 0) {
				var bitmap = new Module.VectorInt();

				var codeHex = '';

				for(var jj = 0; jj < cmd.bitmap.length; jj += 2) {
					var val = parseInt('0x' + cmd.bitmap.substr(jj, 2));
					bitmap.push_back(val);

					codeHex += '0x' + cmd.bitmap.substr(jj, 2) + ', ';
				}	
				gfx.drawBitmap(parseInt(cmd.x), parseInt(cmd.y), bitmap, parseInt(cmd.width), parseInt(cmd.height), parseInt(cmd.color));

				bitmap.delete();

				// Remove the trailing ', '
				codeHex = codeHex.substr(0, codeHex.length - 2);

				codeDecl += 'const uint8_t bitmap' + cmd.id + '[] = {' + codeHex + '};\n';
				codeImpl += indent + gfxClass + 'drawBitmap(' + cmd.x + ', ' + cmd.y + ', bitmap' + cmd.id + ', ' + cmd.width + ', ' + cmd.height + ', ' + cmd.color + ');\n';				
			}
			break;

		default:
			console.log("unknown command", cmd);
			break;
		}
	}
	codeImpl += indent + gfxClass + 'display();\n';

	codeImpl += '}\n';

	if (heavy) {
		mainApp.codeText = codeIncl + codeDecl + '\n' + codeImpl;
	}

	await nextAnimationFrame();

	render();

	if (!heavy) {
		debouncedGenerateCode(); // queue up code regen
	}
}

function mainCanvasX(x) {
	return margin + x * zoom;
}
function mainCanvasY(y) {
	return margin + y * zoom + ((mainApp.displayType === 'yellow' && y >= yellowTopSize) ? zoom : 0);
}
function mainCanvasWidth() {
	return (2 * margin) + (screenx * zoom);
}
function mainCanvasHeight() {
	return (2 * margin) + (screeny * zoom) + ((mainApp.displayType === 'yellow') ? zoom : 0);
}
function miniCanvasLeft() {
	return (screenx * zoom) + (2 * margin) + miniSeparator;	
}
function miniCanvasX(x) {
	return miniCanvasLeft() + miniMargin + x;
}
function miniCanvasY(y) {
	return miniMargin + y + ((mainApp.displayType === 'yellow' && y >= yellowTopSize) ? 1 : 0);
}
function miniCanvasWidth() {
	return (2 * miniMargin) + screenx;
}
function miniCanvasHeight() {
	return (2 * miniMargin) + screeny + ((mainApp.displayType === 'yellow') ? 1 : 0);
}

function totalWidth() {
	return miniCanvasLeft() + miniCanvasWidth();
}

function render() {
	// Bytes are left to right, top to bottom, one bit per byte
	// Within the byte 0x80 is the leftmost pixel, 0x40 is the next, ... 0x01 is the rightmost pixel in the byte
	var bytes = gfx.getBytes();

	var canvas = /** @type {HTMLCanvasElement} */
		(document.getElementById("mainCanvas"));
	var ctx = canvas.getContext("2d");
	ctx.resetTransform();
	ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

	var yellow = (mainApp.displayType === 'yellow');
	
	ctx.clearRect(0, 0, canvas.width, canvas.height);

	ctx.fillStyle = "#000000";
	ctx.fillRect(0, 0, mainCanvasWidth(), mainCanvasHeight());
	if (showMini) {
		ctx.fillRect(miniCanvasLeft(), 0, miniCanvasWidth(), miniCanvasHeight());
	}

	ctx.fillStyle = displayWhite;

	var byteIndex = 0;
	var onColor = displayWhite;
	
	for(var yy = 0; yy < screeny; yy++) {
		if (yellow) {
			if (yy < yellowTopSize) {
				onColor = displayYellow;				
			}
			else {
				onColor = displayBlue;
			}
		}
		for(var xx = 0; xx < screenx; xx += 8) {
			var pixel8 = bytes[byteIndex++];

			for(var ii = 0; ii < 8; ii++) {
				var pixel = ((pixel8 & (1 << (7 - ii))) != 0) ? 1 : 0;
				
				if (mainApp.invertDisplay) {
					pixel = Number(!pixel);
				}
				
				ctx.fillStyle = pixel ? onColor : displayBlack;
				ctx.fillRect(mainCanvasX(xx + ii), mainCanvasY(yy), 0.9*zoom, 0.9*zoom);
				if (showMini) {
					ctx.fillRect(miniCanvasX(xx + ii), miniCanvasY(yy), 0.9, 0.9);
				}
			}
		}
	}
	if (mainApp.hoveredObject) {
		const obj = mainApp.hoveredObject;
		if (obj.type == "rect") {
			ctx.fillStyle = "#fff1";
			ctx.fillRect(
				mainCanvasX( obj.x ),
				mainCanvasY( obj.y ),
				mainCanvasX( obj.w - 2 ),
				mainCanvasY( obj.h - 2 )
			);
		}
	}
	if (mainApp.constructionLines) {
		mainApp.objects.forEach(obj => {
			switch (obj.type) {
			// TODO: repetition of calculating dimensions, rect and text, if not more
			case "rect":
				ctx.strokeStyle = "#fff3";
				ctx.lineWidth = zoom * 0.25;
				ctx.strokeRect(
					mainCanvasX( obj.x + 0.5 * 0.9 ),
					mainCanvasY( obj.y + 0.5 * 0.9 ),
					mainCanvasX( obj.w - 3 ),
					mainCanvasY( obj.h - 3 )
				);
				break;
			case "text":
				ctx.strokeStyle = "#fff3";
				ctx.lineWidth = zoom * 0.25;
				// let charWidth = 5;
				// let charHeight = 4;
				// let textWidth = obj.text.length * charWidth;
				ctx.strokeRect(
					mainCanvasX( obj.x - 1 + 0.5 * 0.9 ),
					mainCanvasY( obj.y - 1 + 0.5 * 0.9 ),
					mainCanvasX( obj.w - 1 ),
					mainCanvasY( obj.h - 1 )
				);
				break;
			}
		});
	}
	if (mainApp.showSelection) {
		mainApp.selectedObjects.forEach(selectedObj => {
			switch (selectedObj.type) {
			case "rect":
				ctx.strokeStyle = "#f80";
				ctx.lineWidth = zoom * 0.5;
				ctx.strokeRect(
					mainCanvasX( selectedObj.x + 0.5 * 0.9 ),
					mainCanvasY( selectedObj.y + 0.5 * 0.9 ),
					mainCanvasX( selectedObj.w - 3 ),
					mainCanvasY( selectedObj.h - 3 )
				);
				break;
			case "text": 
				ctx.strokeStyle = "#f80";
				ctx.lineWidth = zoom * 0.5;
				// let charWidth = 5;
				// let charHeight = 4;
				// let textWidth = selectedObj.text.length * charWidth;
				ctx.strokeRect(
					mainCanvasX( selectedObj.x - 1 + 0.5 * 0.9 ),
					mainCanvasY( selectedObj.y - 1 + 0.5 * 0.9 ),
					mainCanvasX( selectedObj.w - 1 ),
					mainCanvasY( selectedObj.h - 1 )
				);
				break;
			}
		});
	}
}

function quotedC(str) {

	str = str.replace('\\', '\\\\');
	str = str.replace('"', '\\"');

	return '"' + str + '"';
}

// Standard logos
const particle128x32 = '0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000018000000000000000000000000000000180003fe000000000000006000000020380c03ffc0000003818000600000003838380383f0000003818000600000001e3c70038078000003818000600000000fbdf00380380000038000006000000007c7e0038018fe0c1bfd81f06078000007ffc003801bff8cfbfd87fc61ff000003ff8003801b83cfe3818f1f63c780003dfff803803800cf83819c0767038003feff7f83807000ef0381b8006e01c000fdff7f03ffe07fee0381b0006c00c00003ff8003ffc1ffec0381b0006fffc00003ffc0038007c0ec0381b0006fffc00007efe003800700ec0381b0006c0000000fbbe003800600ec0381b8006e0000001f3cf003800600ec0381b8026e0000001c383803800703ec01819e076701c00030381c038003ffec01fd8ffe63ff8000001800038001feec00fd83fc61ff0000001800000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';
const particle32x32 = '00018000000180000001800000018000080180100603c0600703c0e003c3c3c001e3cf8001f99f8000fe7f0000fffe00007ffe00003ffc0007bffde0ffdffbffffdffbff07bffde0003ffc00007ffe0000fffe0000fe7f0001f99f8001e3cf8003c3c3c00703c0e00603c0600801801000018000000180000001800000018000';
const particle48x48 = '000001000000000001800000000001800000000001800000000001800000000003c00000000003c00000018003c0018001c003c0038000f007c00f00007807e01e00007e07e07e00003f07e0fc00001fc7e3f800001fe18ff800000ff81ff0000007fe7fe0000007ffffe0000003ffffc0000003ffff80000001ffff8000003cffff3c0007fcffff3fe0fffe7ffe7ffffffe7ffe7fff07fcffff3fe0003cffff3c000001ffff80000003ffff80000003ffffc0000007ffffe0000007fe7fe000000ff81ff000001fe18ff800001fc7e3f800003f07e0fc00007e07e07e00007807e01e0000f007c00f0001c003c00380018003c00180000003c00000000003c00000000001800000000001800000000001800000000001800000000001000000';
const adafruit82x64 = '00000000000180000000000000000000038000000000000000000007C000000000000000000007C00000000000000000000FC00000000000000000001FE00000000000000000001FE00000000000000000003FE00000000000000000003FF00000000000000000007FF0000000000000001FF87FF0000000000000003FFE7FF0000000000000003FFF7FF0000000000000001FFFFBE0000000000000000FFFF9FFC00000000000000FFFF9FFF800000000000007FFF1FFFF00000000000003FC73FFFF80000000000001FE3FFFFF80000000000000FF1E0FFF000000000000007FFE1FFC000000000000003FFFFFF8000000000000000FDFFFE0000000000000001F19FFC0000000000000003F3CFF00000000000000007E7CF800000000000000007FFE7C0000000000000000FFFFFC0000000000000000FFFFFE0000000000000000FFFFFE0000000000000001FFEFFE0000000000000001FFCFFE0000000000000003FF07FE0000000000000003FC07FE0000000000000003F003FE00000000000000018000FE000000000000000000007E000000000000000000003E000000000000000000000C000000000000078000FC000003C0000000078001FC000003C0000000078001FC000003C0000000078001E00000001E000000078001E00000001E007FE3F79FF9FDE7787BDFC0FFF7FFBFFDFDFF787BDFC0FFF7FFBFFDFDFF787BDFC0F0F787BC3DE1FF787BDE00F0F787BC3DE1F0787BDE0000F787803DE1E0787BDE007FF7879FFDE1E0787BDE00FFF787BFFDE1E0787BDE00F0F787BC3DE1E0787BDE00F0F787BC3DE1E0787BDE00F0F787BC3DE1E0787BDE00FFF7FFBFFDE1E07FFBDFC0FFF7FFBFFDE1E07FFBDFC07CF3F39F3DE1E03E7BCFC00000000000000000000000FFFFFFFFFFFFFFFFFFFFC0FFFFFFFFFD68DB111A31C0FFFFFFFFFD2B5AFB6AEFC0FFFFFFFFFD4B5B3B1A33C0FFFFFFFFFD6B5BDB6AFDC0';
const adafruit115x32 = '0000600000000000000000000000000000E00000000000000000000000000001E00000000000000000000000000001F00000000000000000000000000003F00000000000000000000000000007F00000000000000000000000000007F8000000000000000000000000000FF800000003C0007E000001E0007F0FF800000003C000FE000001E000FFEFF800000003C000FE000001E000FFFFF800000003C000F00000000F007FFE7FC0000003C000F00000000F003FFE7FF83FF1FBCFFCFEF3BC3DEFE01FFE7FFF7FFBFFDFFEFEFFBC3DEFE01FC6FFFF7FFBFFDFFEFEFFBC3DEFE00FE3C7FE787BC3DE1EF0FFBC3DEF0007FF87FC787BC3DE1EF0F83C3DEF0001FFFFF0007BC3C01EF0F03C3DEF0001F37FE03FFBC3CFFEF0F03C3DEF0003E33F807FFBC3DFFEF0F03C3DEF0007E73C00787BC3DE1EF0F03C3DEF0007FFBE00787BC3DE1EF0F03C3DEF0007FFFE00787BC3DE1EF0F03C3DEF000FFFFE007FFBFFDFFEF0F03FFDEFE00FFFFF007FFBFFDFFEF0F03FFDEFE00FF9FF003E79F9CF9EF0F01F3DE7E01FF1FF0000000000000000000000001F80FF007FFFFFFFFFFFFFFFFFFFE01C007F007FFFFFFFFEB46D888D18E000001F007FFFFFFFFE95AD7DB577E000000F007FFFFFFFFEA5AD9D8D19E0000006007FFFFFFFFEB5ADEDB57EE0';



