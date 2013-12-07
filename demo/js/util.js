var
  // name of master window (a named pop up)
  FLOCK_MASTER = 'flockmaster_windowname',
  screenWidth = screen.availWidth,
  screenHeight = screen.availHeight,
  isIE = !!window.attachEvent,
  bind = isIE ?
    function (object, eventName, callback) {
      object.attachEvent('on' + eventName, callback);
    } :
    function (object, eventName, callback) {
      object.addEventListener(eventName, callback, false);
    },
  unbind = isIE ?
    function (object, eventName, callback) {
      object.detachEvent('on' + eventName, callback);
    } :
    function (object, eventName, callback) {
      object.removeEventListener(eventName, callback, false);
    },
  setText = isIE ?
    function (node, text) {
      node.innerText = text;
    } :
    function (node, text) {
      node.textContent = text;
    }
;

function mix(base) {
  var
    argumentIdx = 1,
    source,
    member
  ;
  while (source = arguments[argumentIdx++]) {
    for (member in source) {
      if (source.hasOwnProperty(member)) {
        base[member] = source[member];
      }
    }
  }
  return base;
}


function random(min, max) {
  var argLn = arguments.length;
  if (!argLn) {
    min = 0;
    max = 1000;
  } else if (argLn === 1) {
    max = min;
    min = 0;
  }
  return Math.round(Math.random() * max) + min;
}

function launchBirdWindow (flockId) {
  return window.open(
    'bird.html?flock=' + flockId,
    'bird-' + Math.random(),
    'status=0,menubar=0,toolbar=0,location=0,resizable=0,scrollbars=0,dialog=1,width=100,height=100,top=' + random(screenHeight) + ',left=' + random(screenWidth)
  );
}