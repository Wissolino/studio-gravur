var PRODS = [
  {id:'round',   name:'Rund',        shape:'round',  w:190,h:190, real:'Ø 20 cm',  price:35, extra:'Holzständer'},
  {id:'square',  name:'Quadratisch', shape:'square', w:190,h:190, real:'20×20 cm', price:50, extra:'Holzständer'},
  {id:'rect',    name:'Rechteckig',  shape:'rect',   w:260,h:174, real:'30×20 cm', price:70, extra:'Holzständer'},
];
var FF = {
  cormorant:"'Cormorant Garamond',serif",
  cinzel:"'Cinzel',serif",
  playfair:"'Playfair Display',serif",
  lora:"'Lora',serif",
  ebgaramond:"'EB Garamond',serif",
  baskerville:"'Libre Baskerville',serif",
  dancing:"'Dancing Script',cursive",
  greatvibes:"'Great Vibes',cursive",
  sacramento:"'Sacramento',cursive",
  raleway:"'Raleway',sans-serif",
  josefin:"'Josefin Sans',sans-serif",
  montserrat:"'Montserrat',sans-serif",
  bebas:"'Bebas Neue',sans-serif"
};
var FONT_NAMES = {
  cormorant:'Cormorant',
  cinzel:'Cinzel',
  playfair:'Playfair',
  lora:'Lora',
  ebgaramond:'EB Garamond',
  baskerville:'Baskerville',
  dancing:'Dancing Script',
  greatvibes:'Great Vibes',
  sacramento:'Sacramento',
  raleway:'Raleway',
  josefin:'Josefin Sans',
  montserrat:'Montserrat',
  bebas:'Bebas Neue'
};

var imgSrc  = null;
var selProd = null;
var selId   = null;   // aktuell ausgewähltes Layer
var curFont = 'cormorant';
var layers  = [];     // [{id,type,x,y,...}]
// ── Undo/Redo ──────────────────────────────
var _history   = [];  // Snapshots vor Änderungen
var _redoStack = [];  // Snapshots nach Undo
var _HIST_MAX  = 30;
function saveHistory(){
  _history.push(JSON.stringify(layers));
  if(_history.length>_HIST_MAX) _history.shift();
  _redoStack=[];
  _updateUndoBtn();
}
function undo(){
  if(!_history.length) return;
  _redoStack.push(JSON.stringify(layers));
  layers=JSON.parse(_history.pop());
  selId=null; renderAll(); buildCtrl(); updateFilled(); _updateUndoBtn();
}
function redo(){
  if(!_redoStack.length) return;
  _history.push(JSON.stringify(layers));
  layers=JSON.parse(_redoStack.pop());
  selId=null; renderAll(); buildCtrl(); updateFilled(); _updateUndoBtn();
}
function _updateUndoBtn(){
  var btn=byId('undoBtn');
  if(btn) btn.disabled=!_history.length;
}
// Live-Text-Layer: ein einzelnes Layer das den aktuellen Textarea-Inhalt zeigt
var liveTextId = null;
var lastTapId  = null;  // Doppelklick-Erkennung (überlebt re-renders)
var lastTapTime= 0;

function byId(id){return document.getElementById(id);}
function getLyr(id){return layers.find(function(l){return l.id===id;})||null;}
function newId(){return 'l'+(Date.now()+Math.random()).toString(36);}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

function buildCurveSvg(l,vpW){
  var curve=l.curve||0;
  var absC=Math.abs(curve);
  var fs=l.size;
  var ff=FF[l.font]||FF.cormorant;
  var textW=l.content.length*fs*0.58;
  var pad=fs*0.8;
  var angleRad=absC*(Math.PI/180);
  var r=Math.max(fs, textW/Math.max(angleRad,0.01));
  var sw, sh, pathD, anchorX, anchorY;

  if(absC>=358){
    sw=r*2+pad*2; sh=r*2+pad*2;
    var cx=sw/2, cy=sh/2;
    var dir=curve>0?1:0;
    pathD='M '+(cx-r)+','+cy+' A '+r+','+r+' 0 1,'+dir+' '+(cx+r)+','+cy+
          ' A '+r+','+r+' 0 1,'+dir+' '+(cx-r)+','+cy;
    anchorX=sw/2; anchorY=sh/2;
  } else {
    var halfAngle=angleRad/2;
    // SVG so gross wie voller Kreis: text kann nie rausragen, kein Clip im Canvas
    sw=r*2+pad*2;
    sh=r*2+pad*2;
    var svgCx=sw/2;
    var sign=curve>0?-1:1;
    var circleCy=sh/2;  // Kreismittelpunkt = SVG-Zentrum
    var startX=svgCx-r*Math.sin(halfAngle);
    var startY=circleCy-sign*r*Math.cos(halfAngle);
    var endX  =svgCx+r*Math.sin(halfAngle);
    var endY  =startY;
    var largeArc=absC>180?1:0;
    var sweep=curve>0?0:1;
    pathD='M '+startX.toFixed(2)+','+startY.toFixed(2)+
          ' A '+r.toFixed(2)+','+r.toFixed(2)+' 0 '+largeArc+','+sweep+
          ' '+endX.toFixed(2)+','+endY.toFixed(2);
    anchorX=svgCx; anchorY=startY;
  }

  var uid='cp'+l.id+'_'+Date.now();
  var html='<svg xmlns="http://www.w3.org/2000/svg" width="'+sw.toFixed(1)+'" height="'+sh.toFixed(1)+
    '" overflow="visible" style="display:block;pointer-events:none;opacity:.70">'+
    '<defs><path id="'+uid+'" d="'+pathD+'"/></defs>'+
    '<text font-family="'+ff+'" font-size="'+fs+'px" fill="#fff" '+
      'stroke="rgba(0,0,0,.5)" stroke-width="1" paint-order="stroke fill">'+
      '<textPath href="#'+uid+'" startOffset="50%" text-anchor="middle">'+esc(l.content)+'</textPath>'+
    '</text></svg>';
  return {html:html, ax:anchorX, ay:anchorY, sw:sw, sh:sh};
}
function findPhoto(){return layers.find(function(l){return l.type==='photo';})||null;}

// ══════════════ BUILD GRID ══════════════
function buildGrid(){
  var g=byId('pgrid'); g.innerHTML='';
  PRODS.forEach(function(p){
    var c=document.createElement('div');
    c.className='pc'; c.id='pc-'+p.id;
    c.innerHTML=
      '<div class="pch">'+
        '<div><div class="pcn">'+p.name+'</div><div class="pcs">'+p.real+'</div><div class="pce">inkl. '+p.extra+'</div></div>'+
        '<div class="pcp">'+p.price+' €</div>'+
      '</div>'+
      '<div class="vpw">'+
        '<div class="vp '+p.shape+'" id="vp-'+p.id+'" style="width:'+p.w+'px;height:'+p.h+'px">'+
          '<div class="sl-base"></div><div class="sl-noise"></div><div class="sl-grain"></div><div class="sl-sheen"></div>'+
          '<div class="guide h mid-h" id="g-mh-'+p.id+'"></div><div class="guide v mid-v" id="g-mv-'+p.id+'"></div><div class="guide h edge-t" id="g-et-'+p.id+'"></div><div class="guide h edge-b" id="g-eb-'+p.id+'"></div><div class="guide v edge-l" id="g-el-'+p.id+'"></div><div class="guide v edge-r" id="g-er-'+p.id+'"></div>'+
          '<div class="da" id="da-'+p.id+'"></div>'+
          '<div class="sl-vig"></div><div class="sl-edge"></div>'+
          '<div class="vhint"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><span>Vorschau</span></div>'+
        '</div>'+
      '<div class="da-ov" id="daov-'+p.id+'"></div>'+
      '</div>'+
      '<div class="pact-row" id="pact-'+p.id+'">'+
        '<button class="pact-btn pact-bild" id="pbild-'+p.id+'">'+
          '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>'+
          'Bild hochladen'+
        '</button>'+
        '<button class="pact-btn pact-text" id="ptxt-'+p.id+'">'+
          '<svg viewBox="0 0 24 24"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>'+
          '+ Text'+
        '</button>'+
        '<button class="pact-btn" id="undoBtn" disabled title="Rückgängig (Strg+Z)" style="flex:0;padding:7px 10px">'+
          '<svg viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/></svg>'+
        '</button>'+
      '</div>'+
      '<div class="pctrl" id="ctrl-'+p.id+'"></div>'+
      '<div class="pch-hint">↑ Zum Auswählen klicken</div>';

    // Card-Klick → Platte wählen (nicht auf Slider/Arrow/Controls)
    c.addEventListener('mousedown', function(e){
      if(e.target.closest('.sl,.arr,.pctrl,.card-text-input,.font-dd,.font-sel,.font-list,.font-opt')) return;
      if(!e.target.closest('.elw')){ selectProd(p.id); buildCtrl(); }
    });
    c.addEventListener('touchstart', function(e){
      if(e.target.closest('.sl,.arr,.pctrl,.card-text-input,.font-dd,.font-sel,.font-list,.font-opt')) return;
      if(!e.target.closest('.elw')){ selectProd(p.id); buildCtrl(); }
    },{passive:true});

    // Bild/Text-Buttons direkt verdrahten
    (function(pid){
      c.querySelector('#pbild-'+pid).addEventListener('click',function(e){
        e.stopPropagation();
        selectProd(pid);
        byId('fileIn').click();
      });
      c.querySelector('#ptxt-'+pid).addEventListener('click',function(e){
        e.stopPropagation();
        selectProd(pid);
        var ntid='txt-'+Date.now();
        liveTextId=ntid; selId=ntid;
        saveHistory();
        layers.push({id:ntid,type:'text',content:'Text',x:50,y:50,size:20,font:curFont,rot:0,curve:0});
        renderAll(); buildCtrl();
        setTimeout(function(){
          var nta=byId('cti-ta-'+pid); if(nta){nta.focus();nta.select();}
        },60);
      });
      var undoB=c.querySelector('#undoBtn');
      if(undoB) undoB.addEventListener('click',function(e){ e.stopPropagation(); undo(); });
    })(p.id);

    g.appendChild(c);
  });
}

// ══════════════ RENDER ══════════════
function renderAll(){
  PRODS.forEach(function(p){renderProd(p);});
  buildCtrl();
  updateFilled();
  saveState();
}

function renderProd(p){
  var da=byId('da-'+p.id); if(!da) return;
  da.innerHTML='';
  var daov=byId('daov-'+p.id);
  if(daov){
    daov.innerHTML='';
    // daov exakt auf .vp zentrieren (selbe Position wie .vp innerhalb .vpw)
    daov.style.left='50%';
    daov.style.top='50%';
    daov.style.transform='translate(-50%,-50%)';
    daov.style.width=p.w+'px';
    daov.style.height=p.h+'px';
  }
  layers.forEach(function(l,i){
    var wrap=document.createElement('div');
    wrap.className='elw';
    wrap.dataset.lid=l.id;
    // sel nur für normalen Text + Foto (curved text bekommt eigene Behandlung)
    if(l.id===selId && !(l.type==='text' && l.curve && Math.abs(l.curve)>5)) wrap.classList.add('sel');

    if(l.type==='photo'){
      var src=l.src||imgSrc;
      if(!src) return;
      wrap.classList.add('photo-wrap');
      wrap.style.cssText='position:absolute;inset:0;cursor:move;z-index:'+(i+1)+';';
      var img=document.createElement('img');
      img.className='el-photo'; img.src=src; img.draggable=false;
      img.style.transform='translate(calc(-50% + '+l.x+'px),calc(-50% + '+l.y+'px)) scale('+(l.zoom/100)+') rotate('+l.rot+'deg)';
      wrap.appendChild(img);
    } else if(l.type==='text'){
      if(!l.content||!l.content.trim()) return;
      var x=(l.x/100)*p.w, y=(l.y/100)*p.h;
      if(l.curve && Math.abs(l.curve)>5){
        var allLines=l.content.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n');
        var l0=Object.assign({},l,{content:allLines[0]||' '});
        var cv0=buildCurveSvg(l0,p.w);
        var lineH=cv0.sh;
        var totalH=lineH*allLines.length;
        wrap.style.cssText='position:absolute;left:'+(x-cv0.ax).toFixed(1)+'px;top:'+(y-cv0.ay).toFixed(1)+'px;'+
          'transform:rotate('+l.rot+'deg);transform-origin:'+cv0.ax.toFixed(1)+'px '+cv0.ay.toFixed(1)+'px;'+
          'z-index:'+(i+10)+';overflow:visible;';
        var combined='';
        allLines.forEach(function(line,li){
          var lLine=Object.assign({},l,{content:line||' '});
          var cv=buildCurveSvg(lLine,p.w);
          combined+='<g transform="translate(0,'+(li*lineH)+')">'+ cv.html +'</g>';
        });
        var totalW=cv0.sw;
        wrap.innerHTML='<svg width="'+totalW.toFixed(1)+'" height="'+totalH.toFixed(1)+'" overflow="visible" style="display:block;pointer-events:none">'+combined+'</svg>';
        wrap.style.mixBlendMode='';
        wrap.style.opacity='';
        // Kein addResizeHandles für curved text (verursacht Layout-Probleme + sinnlos bei Wölbung)
        // Curved text in da-ov (außerhalb .vp, kein clip)
        setupDrag(wrap,l,p);
        if(daov) daov.appendChild(wrap); else da.appendChild(wrap);
        return;
      } else {
        wrap.style.cssText='position:absolute;left:'+x+'px;top:'+y+'px;transform:translate(-50%,-50%) rotate('+l.rot+'deg);z-index:'+(i+10)+';text-align:center;';
        var span=document.createElement('div');
        span.className='el-text';
        span.style.fontSize=l.size+'px';
        span.style.fontFamily=FF[l.font]||FF.cormorant;
        span.style.whiteSpace='pre';
        span.style.textAlign='center';
        span.textContent=l.content.replace(/\r\n/g,'\n').replace(/\r/g,'\n');
        wrap.appendChild(span);
      }
      // Resize-Handles für ausgewählten Text
      if(l.id===selId && l.type==='text'){
        addResizeHandles(wrap, l, p);
      }
    }

    setupDrag(wrap,l,p);
    // Fotos → da (wird von .vp geclippt → runde Form)
    // Text → daov (kein Clip → kein Abschneiden an Ecken)
    if(l.type==='text' && daov) daov.appendChild(wrap);
    else da.appendChild(wrap);
  });
}

// ══════════════ DRAG ══════════════
function setupDrag(wrap,l,p){
  var vp=byId('vp-'+p.id);
  var dragging=false,sx,sy,slx,sly,rect,dispScale=1;

  wrap.addEventListener('mousedown', onDown);
  wrap.addEventListener('touchstart', function(e){ onDown(e); }, {passive:false});

  function onDown(e){
    if(e.target.closest('.sl,.arr,.lay-btn,.lay-x,.lay-pill,.pctrl')) return;
    e.stopPropagation(); e.preventDefault();

    // Doppelklick / Doppel-Tap auf Text-Layer → Inline-Editor
    var now=Date.now();
    if(l.type==='text' && selId===l.id && lastTapId===l.id && now-lastTapTime<380){
      lastTapId=null; lastTapTime=0;
      openPlateEditor(vp, p, l, wrap);
      return;
    }
    lastTapId=l.id; lastTapTime=now;

    // Auswählen (highlight ohne renderAll)
    if(selId!==l.id){
      if(liveTextId && liveTextId!==l.id) liveTextId=null;
      selId=l.id;
      if(l.type==='text') liveTextId=l.id;
    }
    // Platte immer aktivieren wenn auf ihr gezogen wird
    if(selProd!==p.id){
      selectProd(p.id);
    }
    document.querySelectorAll('.elw').forEach(function(w){
      w.classList.toggle('sel', w.dataset.lid===l.id);
    });
    buildCtrl();

    // Drag sofort starten
    dragging=true;
    rect=vp.getBoundingClientRect();
    dispScale = rect.width / p.w;
    var pt=getPoint(e);
    sx=pt.x; sy=pt.y;
    slx=l.x; sly=l.y; // aktuelle Position merken

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove, {passive:false});
    document.addEventListener('touchend', onUp);
  }

  var SNAP=8; // Snap-Schwelle in Original-Px
  function showGuides(active){
    // active = set von guide-ids die angezeigt werden sollen
    ['mh','mv','et','eb','el','er'].forEach(function(id){
      var g=byId('g-'+id+'-'+p.id);
      if(g) g.classList.toggle('show', !!active[id]);
    });
  }
  function hideGuides(){
    ['mh','mv','et','eb','el','er'].forEach(function(id){
      var g=byId('g-'+id+'-'+p.id); if(g) g.classList.remove('show');
    });
  }
  function snapVal(val, targets, threshold){
    for(var i=0;i<targets.length;i++){
      if(Math.abs(val-targets[i].v)<threshold) return {v:targets[i].v, key:targets[i].k};
    }
    return {v:val, key:null};
  }

  function onMove(e){
    if(!dragging) return;
    e.preventDefault();
    var pt=getPoint(e);
    var dx=pt.x-sx, dy=pt.y-sy;
    var active={};

    if(l.type==='photo'){
      l.x=slx+dx/dispScale; l.y=sly+dy/dispScale;
      var snapX=snapVal(l.x,[{v:0,k:'mv'},{v:-(p.w/2-10),k:'el'},{v:p.w/2-10,k:'er'}],SNAP*3);
      var snapY=snapVal(l.y,[{v:0,k:'mh'},{v:-(p.h/2-10),k:'et'},{v:p.h/2-10,k:'eb'}],SNAP*3);
      if(snapX.key){l.x=snapX.v; active[snapX.key]=true;}
      if(snapY.key){l.y=snapY.v; active[snapY.key]=true;}
      var img=wrap.querySelector('.el-photo');
      if(img) img.style.transform='translate(calc(-50% + '+l.x+'px),calc(-50% + '+l.y+'px)) scale('+(l.zoom/100)+') rotate('+l.rot+'deg)';
    } else {
      var dxOrig = dx / dispScale;
      var dyOrig = dy / dispScale;
      l.x = slx + (dxOrig / p.w) * 100;
      l.y = sly + (dyOrig / p.h) * 100;
      // Innerhalb Platte halten (5% Rand)
      l.x = Math.max(2, Math.min(98, l.x));
      l.y = Math.max(2, Math.min(98, l.y));
      // Snap-Schwelle: 8px in originalen VP-Koordinaten → in %
      var snapThresh = (SNAP / p.w) * 100 * 2.5;
      var snapX=snapVal(l.x,[{v:50,k:'mv'},{v:5,k:'el'},{v:95,k:'er'}],snapThresh);
      var snapY=snapVal(l.y,[{v:50,k:'mh'},{v:5,k:'et'},{v:95,k:'eb'}],snapThresh);
      if(snapX.key){l.x=snapX.v; active[snapX.key]=true;}
      if(snapY.key){l.y=snapY.v; active[snapY.key]=true;}
      if(l.curve && Math.abs(l.curve)>5){
        var cv=buildCurveSvg(l,p.w);
        wrap.style.left=((l.x/100)*p.w - cv.ax).toFixed(1)+'px';
        wrap.style.top=((l.y/100)*p.h - cv.ay).toFixed(1)+'px';
        wrap.style.transform='rotate('+l.rot+'deg)';
      } else {
        wrap.style.left=((l.x/100)*p.w)+'px';
        wrap.style.top=((l.y/100)*p.h)+'px';
        wrap.style.transform='translate(-50%,-50%) rotate('+l.rot+'deg)';
      }
    }
    showGuides(active);
  }

  function onUp(){
    if(!dragging) return;
    dragging=false;
    hideGuides();
    saveHistory();
    renderAll();
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onUp);
  }
}

function deleteLayer(id){
  saveHistory();
  if(id===liveTextId) liveTextId=null;
  layers=layers.filter(function(x){return x.id!==id;});
  if(selId===id) selId=null;
  renderAll(); buildCtrl(); updateFilled();
}

// Entf → Layer löschen (immer, außer in Textarea)
// Backspace → Layer löschen nur wenn KEIN Eingabefeld fokussiert
document.addEventListener('keydown',function(e){
  var active=document.activeElement;
  var inInput=active&&(active.tagName==='TEXTAREA'||active.tagName==='INPUT');
  if(e.key==='Delete'){
    if(inInput) return;
    if(selId){ e.preventDefault(); deleteLayer(selId); }
  }
  if(e.key==='Backspace'){
    if(inInput) return;
    if(selId){ e.preventDefault(); deleteLayer(selId); }
  }
  // Undo / Redo
  if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&e.key==='z'){
    if(inInput) return;
    e.preventDefault(); undo();
  }
  if((e.ctrlKey||e.metaKey)&&(e.key==='y'||(e.shiftKey&&e.key==='z'))){
    if(inInput) return;
    e.preventDefault(); redo();
  }
});

// ══════════════ VORSCHAU-SCHUTZ ══════════════
var _prevModal=byId('prevModal');
_prevModal.addEventListener('contextmenu',function(e){e.preventDefault();return false;});
_prevModal.addEventListener('dragstart',function(e){e.preventDefault();return false;});
_prevModal.addEventListener('copy',function(e){e.preventDefault();return false;});
document.addEventListener('keydown',function(e){
  if(_prevModal.style.display==='none') return;
  if(e.key==='PrintScreen'){e.preventDefault();return false;}
  if((e.ctrlKey||e.metaKey)&&e.key==='s'){e.preventDefault();return false;}
},true);

// ══════════════ COPY / PASTE ══════════════
var _copiedLayer = null;

function copySelectedLayer(){
  if(!selId) return false;
  var l=getLyr(selId);
  if(!l) return false;
  _copiedLayer = JSON.parse(JSON.stringify(l));
  return true;
}
function pasteLayer(){
  if(!_copiedLayer) return;
  saveHistory();
  var nl=JSON.parse(JSON.stringify(_copiedLayer));
  nl.id='l'+Date.now()+'_'+Math.floor(Math.random()*9999);
  nl.x=Math.min(90, nl.x+5);
  nl.y=Math.min(90, nl.y+5);
  layers.push(nl);
  selId=nl.id;
  renderAll(); buildCtrl(); updateFilled();
}

document.addEventListener('keydown',function(e){
  var active=document.activeElement;
  var inInput=active&&(active.tagName==='TEXTAREA'||active.tagName==='INPUT');
  if(inInput) return;
  if((e.ctrlKey||e.metaKey)&&e.key==='c'){
    if(copySelectedLayer()) e.preventDefault();
  }
  if((e.ctrlKey||e.metaKey)&&e.key==='v'){
    e.preventDefault(); pasteLayer();
  }
});

// ══════════════ RECHTSKLICK-MENÜ ══════════════
var _ctxMenu=byId('ctxMenu');
function hideCtx(){ _ctxMenu.style.display='none'; }

document.addEventListener('contextmenu',function(e){
  // Nur auf Platten-Viewport oder Element reagieren
  var onPlate=e.target.closest('.vp,.elw,.el-text');
  if(!onPlate){ hideCtx(); return; }
  e.preventDefault();
  // Buttons aktivieren/deaktivieren
  byId('ctxCopy').disabled=!selId;
  byId('ctxPaste').disabled=!_copiedLayer;
  byId('ctxDelete').disabled=!selId;
  // Position berechnen (am Rand halten)
  var x=e.clientX, y=e.clientY;
  var mw=170, mh=120;
  if(x+mw>window.innerWidth) x=window.innerWidth-mw-8;
  if(y+mh>window.innerHeight) y=window.innerHeight-mh-8;
  _ctxMenu.style.left=x+'px';
  _ctxMenu.style.top=y+'px';
  _ctxMenu.style.display='block';
});

document.addEventListener('click',function(){ hideCtx(); });
document.addEventListener('keydown',function(e){ if(e.key==='Escape') hideCtx(); });

byId('ctxCopy').addEventListener('click',function(){ copySelectedLayer(); hideCtx(); });
byId('ctxPaste').addEventListener('click',function(){ pasteLayer(); hideCtx(); });
byId('ctxDelete').addEventListener('click',function(){
  if(selId){ deleteLayer(selId); } hideCtx();
});
function getPoint(e){
  if(e.touches&&e.touches.length>0) return{x:e.touches[0].clientX,y:e.touches[0].clientY};
  if(e.changedTouches&&e.changedTouches.length>0) return{x:e.changedTouches[0].clientX,y:e.changedTouches[0].clientY};
  return{x:e.clientX,y:e.clientY};
}

// ══════════════ REGLER + EBENEN UNTER PLATTE ══════════════
function buildCtrl(){
  PRODS.forEach(function(p){
    var div=byId('ctrl-'+p.id); if(!div) return;
    div.innerHTML='';

    // Ebenen-Zeile — immer anzeigen wenn Elemente vorhanden
    if(layers.length>0){
      div.className='pctrl vis';
      var layRow='<div class="lay-row">';
      var photoCount=0;
      layers.slice().reverse().forEach(function(l){
        var ico=l.type==='photo'?'🖼️':l.type==='text'?'Text:':'🎨';
        var nm;
        if(l.type==='photo'){
          photoCount++;
          nm='Foto'+(layers.filter(function(x){return x.type==='photo';}).length>1?' '+photoCount:'');
        } else if(l.type==='text'){
          nm=(l.content||'Text').replace(/\n/g,' ').substring(0,12);
        } else {
          nm=l.content;
        }
        layRow+='<div class="lay-pill'+(l.id===selId?' on':'')+'" data-lid="'+l.id+'" data-pid="'+p.id+'">'+
          '<span class="lay-ico">'+ico+'</span>'+
          '<span class="lay-nm">'+esc(nm)+'</span>'+
          '<button class="lay-x" data-del="'+l.id+'" title="Löschen">✕</button>'+
        '</div>';
      });
      layRow+='</div>';
      div.innerHTML=layRow;

      // onclick wird bei jedem buildCtrl überschrieben (keine Akkumulation)
      div.onmousedown=function(e){
        if(e.target.closest('.lay-pill')||e.target.closest('.lay-x')) e.stopPropagation();
      };
      div.onclick=function(e){
        e.stopPropagation();
        var xBtn=e.target.closest('.lay-x');
        if(xBtn){ deleteLayer(xBtn.dataset.del); return; }
        var pill=e.target.closest('.lay-pill');
        if(!pill) return;
        if(liveTextId && liveTextId!==pill.dataset.lid) liveTextId=null;
        selId=pill.dataset.lid;
        selectProd(pill.dataset.pid);
        var lsel=getLyr(selId);
        if(lsel&&lsel.type==='text') liveTextId=lsel.id;
        document.querySelectorAll('.elw').forEach(function(w){
          w.classList.toggle('sel', w.dataset.lid===selId);
        });
        buildCtrl();
      };
    } else {
      div.className='pctrl';
    }

    // Regler für aktives Element — unter jeder Platte sichtbar (alle teilen denselben Layer)
    var l=selId?getLyr(selId):null;
    if(l){
    var ctrlHtml='';
    if(l.type==='photo'){
      var photoIdx=layers.filter(function(x){return x.type==='photo';}).indexOf(l)+1;
      ctrlHtml=
        '<div class="ctrl-lbl">🖼️ Foto '+(photoIdx>1?photoIdx:'')+'</div>'+
        mkSR('zoom-'+p.id,'Zoom',1,50,l.zoom,'%')+
        mkSR('rot-'+p.id,'Rotation',0,360,l.rot,'°');
    } else {
      var lbl=l.type==='text'?'✏️ '+esc((l.content||'').substring(0,14)):(l.content+' Symbol');
      var smn=l.type==='text'?6:10, smx=l.type==='text'?90:150;
      ctrlHtml=
        '<div class="ctrl-lbl">'+lbl+'</div>'+
        mkSR('size-'+p.id,(l.type==='text'?'Schriftgröße':'Symbolgröße'),smn,smx,l.size,'px')+
        (l.type==='text'?mkSR('curve-'+p.id,'Wölbung',-360,360,l.curve||0,'°'):'')+
        mkSR('rot2-'+p.id,'Rotation',0,360,l.rot,'°');
    }

    // Für Text: Font-Select VOR den Slidern — natives Select, null Bubbling-Probleme
    if(l.type==='text'){
      var pid=p.id;
      var tid=l.id;
      var activeFont=l.font||curFont;

      var optHtml='';
      Object.keys(FF).forEach(function(f){
        optHtml+='<option value="'+f+'"'+(f===activeFont?' selected':'')+' style="font-family:'+FF[f]+'">'+FONT_NAMES[f]+'</option>';
      });

      var inp=document.createElement('div');
      inp.className='card-text-input';
      inp.id='cti-'+pid;
      inp.innerHTML='<div class="tp-lbl" style="margin-bottom:5px">Schriftart</div>'+
        '<select class="font-select" id="fsel-'+pid+'">'+optHtml+'</select>';

      // Font-Select ZUERST anhängen (vor Slidern)
      div.appendChild(inp);
      // ctrlHtml (Slider) danach per insertAdjacentHTML
      div.insertAdjacentHTML('beforeend', ctrlHtml);

      var sel=inp.querySelector('#fsel-'+pid);
      sel.style.fontFamily=FF[activeFont]||FF.cormorant;
      sel.onchange=function(){
        var f=sel.value;
        sel.style.fontFamily=FF[f]||FF.cormorant;
        var lc=getLyr(tid);
        if(lc){ lc.font=f; curFont=f; renderAll(); }
      };
      sel.onmousedown=function(e){ e.stopPropagation(); };
    } else {
      // Kein Text: ctrlHtml normal anhängen
      div.insertAdjacentHTML('beforeend', ctrlHtml);
    }

    if(l.type==='photo'){
      wireCtrlSlider('zoom-'+p.id,'%',function(v){var lp=getLyr(selId);if(lp){lp.zoom=v;renderAll();}});
      wireCtrlSlider('rot-'+p.id,'°',function(v){var lp=getLyr(selId);if(lp){lp.rot=v;renderAll();}});
      wireCtrlArr('zoom-'+p.id,1,50,'%',function(v){var lp=getLyr(selId);if(lp){lp.zoom=v;renderAll();}});
      wireCtrlArr('rot-'+p.id,0,360,'°',function(v){var lp=getLyr(selId);if(lp){lp.rot=v;renderAll();}});
      // Gravur-Hinweis in Karte
      if(!div.querySelector('.gravur-hint-inline')){
        var gh=document.createElement('div');
        gh.className='gravur-hint-inline';
        gh.innerHTML='<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><p><strong>So sieht die echte Gravur aus.</strong> Die Vorschau zeigt wie dein Bild in den Schiefer eingelasert wird.</p>';
        div.appendChild(gh);
      }
    } else {

      wireCtrlSlider('size-'+p.id,'px',function(v){var lc=getLyr(selId);if(lc){lc.size=v;renderAll();}});
      if(l.type==='text') wireCtrlSlider('curve-'+p.id,'°',function(v){var lc=getLyr(selId);if(lc){lc.curve=v;renderAll();}});
      if(l.type==='text') wireCtrlArr('curve-'+p.id,-360,360,'°',function(v){var lc=getLyr(selId);if(lc){lc.curve=v;renderAll();}});
      wireCtrlSlider('rot2-'+p.id,'°',function(v){var lc=getLyr(selId);if(lc){lc.rot=v;renderAll();}});
      wireCtrlArr('size-'+p.id,smn,smx,'px',function(v){var lc=getLyr(selId);if(lc){lc.size=v;renderAll();}});
      wireCtrlArr('rot2-'+p.id,0,360,'°',function(v){var lc=getLyr(selId);if(lc){lc.rot=v;renderAll();}});
    } // end else (text/icon)
    } // end if(l)

  });
}

function mkSR(prefix,label,mn,mx,val,unit){
  return '<div class="slrow">'+
    '<span class="sllbl">'+label+'</span>'+
    '<button class="arr" id="am-'+prefix+'">−</button>'+
    '<input type="range" class="sl" id="sl-'+prefix+'" min="'+mn+'" max="'+mx+'" value="'+val+'">'+
    '<button class="arr" id="ap-'+prefix+'">+</button>'+
    '<span class="slval" id="sv-'+prefix+'">'+val+unit+'</span>'+
  '</div>';
}

function wireCtrlSlider(prefix,unit,cb){
  var sl=byId('sl-'+prefix), sv=byId('sv-'+prefix);
  if(!sl) return;

  // touch-action damit der Browser den Slider-Touch nicht als Scroll interpretiert
  sl.style.touchAction='none';

  function applyVal(clientX){
    var rect=sl.getBoundingClientRect();
    var ratio=Math.max(0,Math.min(1,(clientX-rect.left)/rect.width));
    var mn=+sl.min, mx=+sl.max;
    var v=Math.round(mn+ratio*(mx-mn));
    if(v!==+sl.value){sl.value=v; if(sv) sv.textContent=v+unit; cb(v);}
  }

  // Native input Event (Maus, Desktop)
  sl.addEventListener('input',function(){
    var v=+this.value; if(sv) sv.textContent=v+unit; cb(v);
  });

  // Pointer Events — stopPropagation verhindert Drag auf Eltern
  sl.addEventListener('pointerdown',function(e){
    e.stopPropagation();
    try{sl.setPointerCapture(e.pointerId);}catch(ex){}
  },{passive:false});
  sl.addEventListener('pointermove',function(e){
    e.stopPropagation();
    if(e.buttons===0&&e.pointerType!=='touch') return;
    applyVal(e.clientX);
  },{passive:false});
  sl.addEventListener('pointerup',function(e){e.stopPropagation(); saveHistory();});

  // Touch Events explizit — verhindert dass onDown auf wrap triggert
  sl.addEventListener('touchstart',function(e){
    e.stopPropagation();
  },{passive:false});
  sl.addEventListener('touchmove',function(e){
    e.stopPropagation();
    e.preventDefault();
    if(e.touches.length>0) applyVal(e.touches[0].clientX);
  },{passive:false});
  sl.addEventListener('touchend',function(e){
    e.stopPropagation();
    saveHistory();
  },{passive:false});
}

function wireCtrlArr(prefix,mn,mx,unit,cb){
  var sl=byId('sl-'+prefix), sv=byId('sv-'+prefix);
  function step(dir){
    if(!sl) return;
    var v=Math.max(mn,Math.min(mx,(+sl.value)+dir));
    sl.value=v; if(sv) sv.textContent=v+unit; cb(v);
    saveHistory();
  }
  var bm=byId('am-'+prefix), bp=byId('ap-'+prefix);
  if(bm){bm.addEventListener('click',function(e){e.stopPropagation();step(-1);});bm.addEventListener('touchstart',function(e){e.preventDefault();e.stopPropagation();step(-1);},{passive:false});}
  if(bp){bp.addEventListener('click',function(e){e.stopPropagation();step(+1);});bp.addEventListener('touchstart',function(e){e.preventDefault();e.stopPropagation();step(+1);},{passive:false});}
}

// ══════════════ UPLOAD ══════════════
byId('fileIn').addEventListener('change',function(e){if(e.target.files[0]) loadPhoto(e.target.files[0]);});
function loadPhoto(file){
  var r=new FileReader();
  r.onload=function(ev){
    imgSrc=ev.target.result;
    saveHistory();
    var ex=findPhoto();
    if(!ex){
      layers.unshift({id:newId(),type:'photo',src:imgSrc,x:0,y:0,zoom:25,rot:0});
    } else {
      ex.src=imgSrc; ex.zoom=25; ex.x=0; ex.y=0; ex.rot=0;
    }
    selId=findPhoto().id;
    if(!selProd) selectProd(PRODS[0].id);
    renderAll(); buildCtrl();
    byId('pgrid').classList.add('plates-ready');
    // gravurHint wird in buildCtrl in Karte eingebaut
  };
  r.readAsDataURL(file);
}

// ══════════════ HELPERS ══════════════
function selectProd(pid){
  selProd=pid;
  document.querySelectorAll('.pc').forEach(function(c){c.classList.remove('sel');});
  var c=byId('pc-'+pid); if(c) c.classList.add('sel');
  updateCta();
}
function updateFilled(){
  PRODS.forEach(function(p){
    var vp=byId('vp-'+p.id); if(!vp) return;
    var hasContent=layers.some(function(l){return l.type!=='text'||l.content.trim();});
    if(hasContent) vp.classList.add('filled'); else vp.classList.remove('filled');
  });
  updateExpBtn();
}
function updateCta(){
  var btn=byId('ctaBtn');
  var p=selProd?PRODS.find(function(x){return x.id===selProd;}):null;
  if(p){
    byId('ctaLbl').textContent=p.name;
    byId('ctaP').textContent=p.price+' €';
    var ex=byId('ctaExtra'); if(ex) ex.textContent=p.real+' · inkl. Gravur, Versand & '+p.extra;
    btn.disabled=false;
  } else {
    byId('ctaLbl').textContent='Keine Platte gewählt';
    byId('ctaP').textContent='—';
    var ex=byId('ctaExtra'); if(ex) ex.textContent='inkl. Gravur & Versand';
    btn.disabled=true;
  }
}

// ══════════════ ANFRAGE (gemeinsame Upload-Logik) ══════════════
function uploadToImgBB(base64data, callback){
  var fd=new FormData();
  fd.append('key','08f31ef48294759c12765e4bf81e8b9d');
  fd.append('image', base64data);
  fetch('https://api.imgbb.com/1/upload',{method:'POST',body:fd})
    .then(function(r){return r.json();})
    .then(function(j){callback(j.success?j.data.url:null);})
    .catch(function(){callback(null);});
}

function buildAnfrageMsg(p, photoUrl, gravurUrl){
  var msg='Hallo GET YOUR BOXX!\n\n';
  msg+='Ich habe meinen Entwurf fertig gestaltet und würde ihn gerne bei euch anfragen.\n\n';
  if(gravurUrl) msg+='Mein Entwurf:\n'+gravurUrl+'\n\n';
  msg+='Format: '+p.name+' ('+p.real+')\n';
  msg+='Preis: '+p.price+' EUR\n';
  if(imgSrc) msg+='\nOriginalfoto:\n'+photoUrl+'\n';
  msg+='\nIch freue mich auf eure Nachricht!';
  return msg;
}

// Führt Upload durch und ruft dann onDone(msg, p) auf
function runAnfrage(triggerBtn, onDone){
  if(!selProd) return;
  var p=PRODS.find(function(x){return x.id===selProd;});
  var orig=triggerBtn.innerHTML;
  triggerBtn.innerHTML='<span class="spin"></span>';
  triggerBtn.disabled=true;

  function finish(photoUrl, gravurUrl){
    var msg=buildAnfrageMsg(p, photoUrl, gravurUrl);
    triggerBtn.innerHTML=orig; triggerBtn.disabled=false; updateCta();
    onDone(msg, p);
  }

  function step1(){
    if(imgSrc){
      uploadToImgBB(imgSrc.split(',')[1], function(photoUrl){
        step2(photoUrl||'(Upload fehlgeschlagen)');
      });
    } else step2('(kein Foto)');
  }
  function step2(photoUrl){
    buildExportCanvas(p, function(cv){
      var gravurB64=cv.toDataURL('image/png').split(',')[1];
      uploadToImgBB(gravurB64, function(gravurUrl){
        finish(photoUrl, gravurUrl||'(Gravur-Upload fehlgeschlagen)');
      });
    });
  }
  step1();
}

// WhatsApp
byId('ctaBtn').addEventListener('click',function(){
  runAnfrage(this, function(msg){
    window.location.href='https://wa.me/4915224242302?text='+encodeURIComponent(msg);
  });
});

// E-Mail
byId('emailFallbackLink').addEventListener('click',function(e){
  e.preventDefault();
  if(!selProd){ window.location.href='mailto:info@getyourboxx.de'; return; }
  var link=this;
  runAnfrage(link, function(msg, p){
    var subject='Gravur-Anfrage: '+p.name+' ('+p.real+')';

    // Nachricht in Zwischenablage kopieren
    function doCopy(){ try{ navigator.clipboard.writeText(msg).catch(fallbackCopy); }catch(e){ fallbackCopy(); } }
    function fallbackCopy(){
      var ta=document.createElement('textarea');
      ta.value=msg; ta.style.cssText='position:fixed;opacity:0';
      document.body.appendChild(ta); ta.select();
      try{ document.execCommand('copy'); }catch(e){}
      document.body.removeChild(ta);
    }
    doCopy();

    // Modal anzeigen
    var overlay=document.createElement('div');
    overlay.style.cssText='position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.82);display:flex;align-items:center;justify-content:center;padding:20px';
    overlay.innerHTML=
      '<div style="max-width:400px;width:100%;background:#1a1c1e;border-radius:14px;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.7);font-family:\'Outfit\',sans-serif">'+
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">'+
          '<span style="font-size:.75rem;font-weight:600;color:#c8a96e;letter-spacing:.08em;text-transform:uppercase">E-Mail-Anfrage</span>'+
          '<button id="emailCancelBtn" style="background:none;border:none;color:#555;font-size:1.1rem;cursor:pointer;line-height:1;padding:2px 6px">✕</button>'+
        '</div>'+
        '<div style="display:flex;align-items:flex-start;gap:13px;margin-bottom:20px">'+
          '<div style="width:38px;height:38px;flex-shrink:0;background:#22252a;border-radius:9px;display:flex;align-items:center;justify-content:center">'+
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c8a96e" stroke-width="1.8"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7l10 7 10-7"/></svg>'+
          '</div>'+
          '<div>'+
            '<div style="font-size:.85rem;font-weight:600;color:#e8e4d9;margin-bottom:5px">Deine Anfrage ist bereit</div>'+
            '<div style="font-size:.74rem;color:#888;line-height:1.65">'+
              'Die vollständige Nachricht liegt in deiner <span style="color:#c8a96e;font-weight:500">Zwischenablage</span>. '+
              'Klick auf den Button — dein Mail-Programm öffnet sich. Dann einmal '+
              '<span style="background:#22252a;color:#e8e4d9;padding:1px 6px;border-radius:4px;font-size:.7rem;font-weight:600">Strg+V</span>'+
              '<span style="color:#666"> &nbsp;/&nbsp; </span>'+
              '<span style="background:#22252a;color:#e8e4d9;padding:1px 6px;border-radius:4px;font-size:.7rem;font-weight:600">⌘V</span>'+
              ' &nbsp;drücken — fertig.'+
            '</div>'+
          '</div>'+
        '</div>'+
        '<button id="emailOpenBtn" style="width:100%;padding:12px;background:#c8a96e;border:none;border-radius:9px;font-family:\'Outfit\',sans-serif;font-size:.82rem;font-weight:700;color:#0d0e0f;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px">'+
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7l10 7 10-7"/></svg>'+
          'Mail-Programm öffnen'+
        '</button>'+
      '</div>';
    document.body.appendChild(overlay);

    byId('emailOpenBtn').addEventListener('click',function(){
      document.body.removeChild(overlay);
      var a=document.createElement('a');
      a.href='mailto:info@getyourboxx.de?subject='+encodeURIComponent(subject);
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    });
    byId('emailCancelBtn').addEventListener('click',function(){
      document.body.removeChild(overlay);
    });
  });
});

// ══════════════ CANVAS EXPORT (global) ══════════════
function buildExportCanvas(p, done, preview){
  var SCALE=3;
  var PAD=80; // Extra-Pixel rundum damit Randtext nicht abgeschnitten wird
  var txtAlpha = preview ? 1.0 : 0.70;
  var W=p.w*SCALE, H=p.h*SCALE;
  var CW=W+PAD*2, CH=H+PAD*2; // Canvas mit Padding
  var cv=document.createElement('canvas');
  cv.width=CW; cv.height=CH;
  var ctx=cv.getContext('2d');

  // Plattenform zeichnen (mit PAD-Offset, damit Mitte stimmt)
  ctx.save();
  ctx.translate(PAD, PAD);
  if(p.shape==='round'){
    ctx.beginPath();
    ctx.arc(W/2,H/2,W/2,0,Math.PI*2);
    ctx.clip();
  }
  ctx.fillStyle='#000';
  ctx.fillRect(0,0,W,H);
  ctx.restore();

  function drawLayers(idx){
    if(idx>=layers.length){ done(cv); return; }
    var l=layers[idx];
    if(l.type==='photo'&&(l.src||imgSrc)){
      var img=new Image();
      img.onload=function(){
        ctx.save();
        ctx.translate(PAD, PAD);
        if(p.shape==='round'){
          ctx.beginPath();
          ctx.arc(W/2,H/2,W/2,0,Math.PI*2);
          ctx.clip();
        }
        ctx.translate(W/2+l.x*SCALE, H/2+l.y*SCALE);
        ctx.rotate(l.rot*Math.PI/180);
        ctx.scale((l.zoom/100)*SCALE, (l.zoom/100)*SCALE);
        ctx.filter='grayscale(1) contrast(1.4) brightness(1.1)';
        ctx.drawImage(img,-img.naturalWidth/2,-img.naturalHeight/2);
        ctx.restore(); drawLayers(idx+1);
      };
      img.onerror=function(){drawLayers(idx+1);};
      img.src=l.src||imgSrc;
    } else if(l.type==='text'&&l.content&&l.content.trim()){
      // Text mit PAD-Offset aber OHNE Clip -> nie abgeschnitten
      var x=PAD+(l.x/100)*p.w*SCALE, y=PAD+(l.y/100)*p.h*SCALE;
      var fs=l.size*SCALE;
      if(l.curve && Math.abs(l.curve)>5){
        var lScaled=Object.assign({},l,{size:fs});
        var cv0=buildCurveSvg(lScaled, p.w*SCALE);
        var dataUrl='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(cv0.html);
        var si=new Image();
        si.onload=function(){
          ctx.save();
          ctx.globalAlpha=txtAlpha;
          ctx.translate(x,y); ctx.rotate(l.rot*Math.PI/180);
          ctx.drawImage(si, -cv0.ax, -cv0.ay);
          ctx.restore();
          drawLayers(idx+1);
        };
        si.onerror=function(){drawLayers(idx+1);};
        si.src=dataUrl;
      } else {
        ctx.save();
        ctx.translate(x,y); ctx.rotate(l.rot*Math.PI/180);
        ctx.globalAlpha=txtAlpha;
        ctx.fillStyle='#fff';
        ctx.strokeStyle='rgba(0,0,0,.5)';
        ctx.lineWidth=SCALE*0.5;
        ctx.lineJoin='round';
        ctx.font=fs+'px '+(FF[l.font]||FF.cormorant);
        ctx.textAlign='center'; ctx.textBaseline='middle';
        var lines=l.content.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n');
        var lh=fs*1.3, th=lh*(lines.length-1);
        lines.forEach(function(ln,li){
          ctx.strokeText(ln,0,li*lh-th/2);
          ctx.fillText(ln,0,li*lh-th/2);
        });
        ctx.restore(); drawLayers(idx+1);
      }
    } else drawLayers(idx+1);
  }
  drawLayers(0);
}


// ══════════════ RESIZE HANDLES ══════════════
function addResizeHandles(wrap, l, p){
  var corners=['tl','tr','bl','br'];
  corners.forEach(function(corner){
    var h=document.createElement('div');
    h.className='rh '+corner;
    h.addEventListener('mousedown', function(e){ startResize(e,l,p,wrap); });
    h.addEventListener('touchstart', function(e){ startResize(e,l,p,wrap); },{passive:false});
    wrap.appendChild(h);
  });
}

function startResize(e, l, p, wrap){
  e.stopPropagation(); e.preventDefault();
  var startSize=l.size;
  var startY=e.touches?e.touches[0].clientY:e.clientY;

  function onMove(ev){
    ev.preventDefault();
    var cy=ev.touches?ev.touches[0].clientY:ev.clientY;
    var dy=cy-startY; // nach unten = größer
    var newSize=Math.max(6,Math.min(90,Math.round(startSize+dy*0.4)));
    if(newSize!==l.size){
      l.size=newSize;
      // Alle Wraps direkt updaten (ohne full render)
      document.querySelectorAll('.elw[data-lid="'+l.id+'"]').forEach(function(w){
        var spans=w.querySelectorAll('.el-text');
        spans.forEach(function(s){ s.style.fontSize=newSize+'px'; });
      });
      // Slider in ctrl updaten
      PRODS.forEach(function(pp){
        var sl=document.getElementById('sl-size-'+pp.id);
        var sv=document.getElementById('sv-size-'+pp.id);
        if(sl){ sl.value=newSize; }
        if(sv){ sv.textContent=newSize+'px'; }
      });
    }
  }
  function onUp(){
    renderAll(); buildCtrl();
    document.removeEventListener('mousemove',onMove);
    document.removeEventListener('mouseup',onUp);
    document.removeEventListener('touchmove',onMove);
    document.removeEventListener('touchend',onUp);
  }
  document.addEventListener('mousemove',onMove);
  document.addEventListener('mouseup',onUp);
  document.addEventListener('touchmove',onMove,{passive:false});
  document.addEventListener('touchend',onUp);
}


// ══════════════ DIREKT AUF PLATTE TIPPEN ══════════════
var plateEditorActive=false;

// Modus A: neuer Layer (clickX/clickY in px relativ zur vp, layerObj=null)
// Modus B: bestehender Layer bearbeiten (layerObj=l, wrap=elw-div)
function openPlateEditor(vp, p, layerOrX, wrapOrY){
  if(plateEditorActive) return;
  plateEditorActive=true;

  var isEdit = (layerOrX && typeof layerOrX === 'object'); // Modus B
  var existingLayer = isEdit ? layerOrX : null;
  var clickX = isEdit ? null : layerOrX;
  var clickY = isEdit ? null : wrapOrY;
  var wrap   = isEdit ? wrapOrY : null;

  var fontSize = existingLayer ? existingLayer.size : 20;
  var fontKey  = existingLayer ? (existingLayer.font||curFont) : curFont;
  var fontFamily = FF[fontKey] || FF.cormorant;

  // Position des Editors
  var edLeft, edTop;
  if(isEdit){
    // Koordinaten aus Layer-Daten
    edLeft = (existingLayer.x/100)*p.w;
    edTop  = (existingLayer.y/100)*p.h;
    // Original-Span verstecken
    if(wrap) wrap.style.opacity='0';
  } else {
    edLeft = clickX;
    edTop  = clickY;
  }

  var ed=document.createElement('textarea');
  ed.className='plate-editor';
  ed.style.fontSize=fontSize+'px';
  ed.style.fontFamily=fontFamily;
  ed.style.left=edLeft+'px';
  ed.style.top=edTop+'px';
  ed.style.transform='translate(-50%,-50%)';
  ed.style.width='120px';
  ed.rows=1;
  if(isEdit) ed.value = existingLayer.content || '';
  vp.appendChild(ed);
  ed.focus();
  // Cursor ans Ende
  ed.selectionStart = ed.selectionEnd = ed.value.length;

  // Auto-resize + nur bei Überlauf an Plattenrand clampen
  function resize(){
    ed.style.height='auto';
    ed.style.height=ed.scrollHeight+'px';
    var lines=ed.value.split('\n');
    var maxLen=Math.max.apply(null,lines.map(function(s){return s.length;}));
    ed.style.width=Math.max(60,Math.min(p.w-20,maxLen*fontSize*0.6+20))+'px';
    // Nur clampen wenn Editor tatsächlich über den Rand ragt
    var edW=parseFloat(ed.style.width)||120;
    var edH=parseFloat(ed.style.height)||fontSize*1.5;
    var curLeft=parseFloat(ed.style.left);
    var curTop =parseFloat(ed.style.top);
    var newLeft=Math.max(edW/2, Math.min(p.w-edW/2, curLeft));
    var newTop =Math.max(edH/2, Math.min(p.h-edH/2, curTop));
    if(newLeft!==curLeft) ed.style.left=newLeft+'px';
    if(newTop !==curTop)  ed.style.top =newTop+'px';
  }
  resize();
  ed.addEventListener('input',resize);

  function confirm(){
    if(plateEditorActive===false) return;
    plateEditorActive=false;
    var val=ed.value;
    if(vp.contains(ed)) vp.removeChild(ed);
    if(isEdit){
      // Layer updaten
      if(existingLayer){
        existingLayer.content = val.trim() ? val : existingLayer.content;
      }
      if(wrap) wrap.style.opacity='';
      renderAll(); buildCtrl(); updateFilled();
    } else {
      // Neuer Layer
      if(!val.trim()) return;
      var xPct=(clickX/p.w)*100;
      var yPct=(clickY/p.h)*100;
      var id=newId();
      layers.push({id:id,type:'text',content:val,x:xPct,y:yPct,size:fontSize,font:curFont,rot:0,curve:0});
      selId=id; liveTextId=id;
      selectProd(p.id);
      renderAll(); buildCtrl(); updateFilled();
    }
  }

  // Enter → Zeilenumbruch (normal), Escape → bestätigen
  ed.addEventListener('keydown',function(e){
    e.stopPropagation();
    if(e.key==='Escape'){ confirm(); }
  });

  // Klick außerhalb → bestätigen
  function onOutside(e){
    if(!ed.contains(e.target)){
      document.removeEventListener('mousedown',onOutside,true);
      document.removeEventListener('touchstart',onOutside,true);
      confirm();
    }
  }
  setTimeout(function(){
    document.addEventListener('mousedown',onOutside,true);
    document.addEventListener('touchstart',onOutside,true);
  },0);
}

// ══════════════ DEMO BILD ══════════════
var DEMO_IMG = 'data:image/jpeg;base64,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';
var demoBtn=byId('demoBtn'); if(demoBtn) demoBtn.addEventListener('click', function(e){
  e.stopPropagation();
  e.preventDefault();
  // Base64 direkt in Blob umwandeln
  var arr = DEMO_IMG.split(',');
  var mime = arr[0].match(/:(.*?);/)[1];
  var bstr = atob(arr[1]);
  var n = bstr.length;
  var u8arr = new Uint8Array(n);
  while(n--){ u8arr[n] = bstr.charCodeAt(n); }
  var blob = new Blob([u8arr], {type: mime});
  var file = new File([blob], 'demo-motorrad.jpg', {type: mime});
  loadPhoto(file);
  // Demo-Bild mit 33% Zoom starten
  setTimeout(function(){
    var ph=findPhoto(); if(ph){ ph.zoom=33; renderAll(); buildCtrl(); }
  },50);
});

// ══════════════ EXPORT / VORSCHAU ══════════════
function exportPlate(p){
  buildExportCanvas(p, function(cv){
    var modal=byId('prevModal');
    var prevCv=byId('prevCanvas');
    prevCv.width=cv.width; prevCv.height=cv.height;
    prevCv.getContext('2d').drawImage(cv,0,0);
    modal.style.display='flex';
  }, true);
}

// Export-Button verdrahten
function wireExpBtn(){
  var btn=byId('expBtn');
  if(!btn) return;
  btn.onclick=function(){
    var p=PRODS.find(function(x){return x.id===selProd;})||PRODS[0];
    exportPlate(p);
  };
  // Modal schließen
  var modal=byId('prevModal');
  byId('prevClose').onclick=function(){ modal.style.display='none'; };
  modal.addEventListener('mousedown',function(e){
    if(e.target===modal) modal.style.display='none';
  });
}

// expBtn aktivieren wenn Bild vorhanden
function updateExpBtn(){
  var btn=byId('expBtn');
  if(!btn) return;
  var hasContent=layers.some(function(l){return l.type==='photo'||l.type==='text';});
  btn.disabled=!hasContent;
}

// ══════════════ START ══════════════
buildGrid();

function saveState(){
  try {
    localStorage.setItem('sc_state', JSON.stringify({
      imgSrc: imgSrc,
      layers: layers,
      selProd: selProd
    }));
  } catch(e){}
}

// State aus localStorage wiederherstellen (Browser-Back, Page-Reload)
(function loadState(){
  try {
    var raw=localStorage.getItem('sc_state');
    if(!raw) return;
    var s=JSON.parse(raw);
    if(s.imgSrc) imgSrc=s.imgSrc;
    if(Array.isArray(s.layers)) layers=s.layers;
    if(s.selProd) selectProd(s.selProd);
    if(layers.length>0){
      renderAll(); buildCtrl();
      byId('pgrid').classList.add('plates-ready');
    }
  } catch(e){}
})();

updateCta();
wireExpBtn();
scalePlatesForMobile();

function scalePlatesForMobile(){
  PRODS.forEach(function(p){
    var vpw=document.querySelector('#pc-'+p.id+' .vpw');
    var vp=byId('vp-'+p.id);
    if(!vpw||!vp) return;
    var available=vpw.clientWidth-20;
    var maxDim=Math.max(p.w,p.h);
    // VP behält immer p.w x p.h — nur CSS-scale ändert die Darstellung
    // Koordinatensystem bleibt unverändert → Drag/Klick stimmen immer
    vp.style.width=p.w+'px';
    vp.style.height=p.h+'px';
    if(available<maxDim){
      var scale=available/maxDim;
      vp.style.transformOrigin='top center';
      vp.style.transform='scale('+scale+')';
      // vpw-Höhe anpassen damit die skalierte Platte keinen leeren Raum lässt
      vpw.style.minHeight=Math.round(p.h*scale+20)+'px';
    } else {
      vp.style.transform='';
      vp.style.transformOrigin='';
      vpw.style.minHeight='';
    }
  });
}
window.addEventListener('resize',scalePlatesForMobile);

// Click auf leere Plattenfläche → Editor öffnen (nach buildGrid!)
PRODS.forEach(function(p){
  var da=document.getElementById('da-'+p.id);
  var vp=document.getElementById('vp-'+p.id);
  if(!da||!vp) return;
  da.addEventListener('mousedown',function(e){
    if(e.target.closest('.elw')) return;
    if(plateEditorActive) return;
    var rect=vp.getBoundingClientRect();
    var x=e.clientX-rect.left, y=e.clientY-rect.top;
    openPlateEditor(da, p, x, y);
  });
  da.addEventListener('touchstart',function(e){
    if(e.target.closest('.elw')) return;
    if(plateEditorActive) return;
    var rect=vp.getBoundingClientRect();
    var t=e.touches[0];
    var x=t.clientX-rect.left, y=t.clientY-rect.top;
    openPlateEditor(da, p, x, y);
  },{passive:false});
});
