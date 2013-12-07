var
  win = this,
  BODY = document.body,
  logNode = document.getElementsByTagName('pre')[0],
  logMsgCnt = 1,
  bird,
  watch_intv,
  animFlag = 0,
  cycling = 0,
  watchingWindow = 0,
  flockName = location.search.match(/\bflock=([^&]+)/)[1],
  targetRegion,
  lastRegion,
  distTolerance = Math.round(Math.random() * 5),
  distMovePercent = .005 + Math.random() * .07,
  getScreenX = typeof win.screenLeft === 'number' ?
    function () {
      return screenLeft;
    } :
    function () {
      return screenX;
    },
  getScreenY = typeof win.screenTop === 'number' ?
    function () {
      return screenTop;
    } :
    function () {
      return screenY;
    }
;

bird = subpost.client(flockName, FLOCK_MASTER)
  .on('::disconnect', function () {
    stopCyclingWindow();
    log('"::disconnect"');
  })
  .on('::connect', function () {
    log('"::connect"');
    if (document.hasFocus()) {
      sendLeadEvent();
    }
  })
  .on('lead', function (msg, region) {
    // ignore when leading
    if (!document.hasFocus()) {
      targetNewCoord(region);
      log('lead: ' + JSON.stringify(region));
    }
  })
  .on('registered', function (msg, number) {
    document.title = 'Bird #' + number + ' in ' + flockName;
    log('registered: ' + number);
  })
  .on('close', function () {
    log('close');
    close();
  })
  .on('stop', function () {
    log('stop');
    stopCyclingWindow();
  })
;

function log(text) {
  return;
  // log event
  var textNode = document.createTextNode(logMsgCnt++ + '. ' + text + '\n');
  if (logNode.firstChild) {
    logNode.insertBefore(textNode, logNode.firstChild);
  } else {
    logNode.appendChild(textNode);
  }
}

function targetNewCoord(region) {
  // use info from region to figure out where to navigate towards
  targetRegion = region;
  // animate towards new coord
  animFlag = 1;
  startCyclingWindow();
}

function startCyclingWindow() {
  if (!cycling) {
    // start watching from current position
    cycling = 1;
    // check window position every 50 ms
    watch_intv = setInterval(cycleWindow, 100);
  }
}

function stopCyclingWindow() {
  if (cycling) {
    cycling = 0;
    clearInterval(watch_intv);
  }
}

// called while leading or following
function cycleWindow() {
  if (animFlag) {
    if (targetRegion) {
      moveToCoord();
    } else {
      stopCyclingWindow();
    }
  } else {
    watchWindowRegion();
  }
}

function moveToCoord() {
  var
    curRegion = getWindowRegion(),
    tgtPoint = regionCenter(targetRegion),
    curPoint = regionCenter(curRegion),
    threshold = regionRadius(curRegion) + regionRadius(targetRegion),
    nxtPoint = {
      x: curPoint.x,
      y: curPoint.y
    }
  ;

  nxtPoint.x += distMovePercent * (tgtPoint.x - curPoint.x) - curRegion.width/2;
  nxtPoint.y += distMovePercent * (tgtPoint.y - curPoint.y) - curRegion.height/2;

  moveTo(nxtPoint.x, nxtPoint.y);
  // stop when within tolerated distance
  if (pointDistance(nxtPoint, tgtPoint) < threshold) {
    stopCyclingWindow();
  }
}

function regionCenter(region) {
  return {
    x: region.x + region.width/2,
    y: region.y + region.height/2
  };
}

function pointDistance(pointA, pointB) {
  var
    squaredX = pointA.x - pointB.x,
    squaredY = pointA.y - pointB.y
  ;
  squaredX *= squaredX;
  squaredY *= squaredY;
  return Math.sqrt(squaredX + squaredY);
}

function regionRadius(region) {
  return pointDistance(regionCenter(region), region);
}

// function moveToCoord() {
//   var
//     targetX = targetRegion.x,
//     targetY = targetRegion.y,
//     curX = getScreenX(),
//     curY = getScreenY(),
//     distX,
//     diffY
//   ;

//   distX = Math.abs(curX - targetX);
//   curX += distX * (curX > targetX ? -distMovePercent : distMovePercent);

//   distY = Math.abs(curY - targetY);
//   curY += distY * (curY > targetY ? -distMovePercent : distMovePercent);

//   moveTo(curX, curY);
//   // stop when within tolerated distance
//   if (distX < distTolerance && distY < distTolerance) {
//     stopCyclingWindow();
//   }
// }

function watchWindowRegion() {
  var curRegion = getWindowRegion();

  if (
    !lastRegion ||
    lastRegion.x !== curRegion.x ||
    lastRegion.y !== curRegion.y ||
    lastRegion.width !== curRegion.width ||
    lastRegion.height !== curRegion.height
  ) {
    lastRegion = curRegion;
    bird.send('lead', lastRegion);
  }
}

function getWindowRegion() {
  return {
    x: getScreenX(),
    y: getScreenY(),
    width: outerWidth,
    height: outerHeight
  };
}

function sendLeadEvent() {
  // force sending "lead" msg
  if (lastRegion) {
    lastRegion.x = -1;
  }
  watchWindowRegion();
}

function onFocus() {
  BODY.className = '';
  animFlag = 0; // prevent animating while the lead
  targetRegion = null;
  sendLeadEvent();
  startCyclingWindow();
}

function onBlur() {
  BODY.className = 'behind';
  animFlag = 1; // allow animating
  stopCyclingWindow();
}

// start watching window motion, when this window is focused
bind(win, 'focus', onFocus);
// stop watching window motion, when this window is blurred
bind(win, 'blur', onBlur);
// disconnect when window is closed
bind(win, 'unload', function () {
  if (document.hasFocus()) {
    bird.send('stop');
  }
  bird.close();
});

if (document.hasFocus()) {
  onFocus();
} else {
  onBlur();
}