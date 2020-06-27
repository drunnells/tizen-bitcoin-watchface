/*
 * Tizen Bitcoin Watch Face
 * Dustin Runnells
 * dustin@runnells.name
 */

// Globals
var lastStep = {}; // Track steps for current day from pedometer (No access to S-Health)
var stepCount = 0;
var hasPrivs = false; // Have we requested all privilages already?
var screenOn = false; // Is screen on?
var lastHrUpdate = 0; // Unix timestamp of last heart rate update
var lastBtcUpdate = 0; // Unix timestamp of last BTC update
var defaultCur = "USD"; // Default currency
var lastBtcPrices = {}; // Last API response from https://blockchain.info/ticker
	
//Rotate watch hands according to angle
function rotateElement(elementID, angle) {
	var element = document.querySelector("#" + elementID);
	element.style.transform = "rotate(" + angle + "deg)";
}

//Update UI according to current time
function updateTime() {
	if (Math.round(Date.now() / 1000) > (lastBtcUpdate + 60)) {
		if (screenOn) {
			getBtc();
		}
	}
    		
	tizen.systeminfo.getPropertyValue("BATTERY",function(bi) {
		var isCharging = bi.isCharging;
		var batteryLevel = Math.round(bi.level * 100);
		$('#bat').html(batteryLevel + '%');
	});
       
	var curtime = new Date(),
		hour = curtime.getHours(),
		minute = curtime.getMinutes(),
		second = curtime.getSeconds(),
		curDate = curtime.getDate(),
		str_curdate = document.getElementById("date-calendar");
	
    rotateElement("hand-main-hour", (hour + (minute / 60) + (second / 3600)) * 30);
    rotateElement("hand-main-minute", (minute + second / 60) * 6);
    rotateElement("hand-main-second", second * 6);
    	$('#date').html(moment().format("MMM D, YYYY"));
    	$('#time').html(moment().format("HH:mm:ss"));
}

// Pedometer Read Success
function pedometerReadSuccess(pedometerInfo) {
	stepCount = pedometerInfo.cumulativeTotalStepCount;
	var dayStart = moment().startOf('day').unix();
	var now = Math.round(Date.now() / 1000);
	if (!lastStep.hasOwnProperty(dayStart)) {
		console.log('Creating object for ' + dayStart);
		lastStep[dayStart] = {};
		lastStep[dayStart].epoch = 0;
		lastStep[dayStart].count= 0;
		stepCount = 0;
		console.log('Daily Step Reset');
		tizen.humanactivitymonitor.stop("PEDOMETER");
		tizen.humanactivitymonitor.start("PEDOMETER", pedometerReadSuccess, pedometerReadError, { 'callbackInterval': 10000 });
		dailyStepCleanup();
		$('#total-step').html(stepCount);
	}
	if (stepCount != lastStep[dayStart].count) {
		lastStep[dayStart].epoch = now;
		lastStep[dayStart].count = stepCount;
		$('#total-step').html(stepCount);
	}
}

// Pedometer Read Error
function pedometerReadError(e) {
	console.log('Pedometer Error:');
	console.log(JSON.stringify(e));
}

// Remove previous day step counts
function dailyStepCleanup() {
	var dayStart = moment().startOf('day').unix();
	var allDays = Object.keys(lastStep);
	console.log('Before:');
	console.log(JSON.stringify(lastStep));
	for (i in allDays) {
		console.log('CHECKING: ' + i);
		if (allDays[i] != dayStart) {
			delete lastStep[allDays[i]];
		}
	}
	console.log('After:');
	console.log(JSON.stringify(lastStep));
}

// Run first
function init() {
	console.log('INIT');
	//Ask user permission to access sensor
	tizen.ppm.requestPermission("http://tizen.org/privilege/healthinfo", function() {
		//HealthInfoPerm Success
		hasPrivs = true;
		tizen.humanactivitymonitor.start("PEDOMETER", pedometerReadSuccess, pedometerReadError, { 'callbackInterval': 10000 });
		tizen.humanactivitymonitor.start('HRM', updateHeartRate);
	}, function(e) {
		//HealthInfoPerm Error
		console.log("error " + JSON.stringify(e));
	});
    		
	//If watch face is visible update UI
	console.log('Add visibility listener');
	document.addEventListener("visibilitychange", function() {
		console.log('visibility change');
		checkScreen();
		if (screenOn) {
			updateTime();
		}
	});
	
	//Set listener to detect change of timezone
	tizen.time.setTimezoneChangeListener(function() {
		updateTime();
	});

	// Rotate through currencies when BTC price is clicked
	$('#btc').click( function() {
		nextCur();
	});

	// Launch S-Health when step counter is clicked
	$('#total-step').click( function() {
		tizen.application.launch("com.samsung.shealth");
	});
	
	// Launch S-Health when heart rate is clicked
	$('#heart').click( function() {
		tizen.application.launch("com.samsung.shealth");
	});
	
	// Launch calendar when heart rate is clicked
	$('#date').click( function() {
		tizen.application.launch("com.samsung.w-calendar2");
	});
       
	// Update clock every second
	updateTime();
	setInterval(function() {
		updateTime();
	}, 1000);
}

// Is screen on?
function checkScreen() {
	if (!document.hidden) {
		if (!screenOn) {
			console.log('SCREEN ON');
			getBtc();
		}
		screenOn = true;
	} else {
		if (screenOn) {
			console.log('SCREEN OFF');
		}
		screenOn = false;
	}
}
  
// Get latest Bitcoin price from blockchain.info API
function getBtc() {
	console.log('Fetching BTC');
	lastBtcUpdate = Math.round(Date.now() / 1000);
	$.ajax({
		url: "https://blockchain.info/ticker",
		success: function(result) {
			lastBtcPrices = result;
			showBtcValue();
		}
	});
}

// Change currency display
function nextCur() {
	if ( $('#btc').html() ) {
		var allCurArray = Object.keys(lastBtcPrices);
		//console.log("All Curs: ");
		//console.log(JSON.stringify(allCurArray));
		for (i in allCurArray) {
			if (allCurArray[i] == defaultCur) {
				break;
			}
		}
		var nextCurNum;
		if ((parseInt(i) + 1) >= parseInt(allCurArray.length)) {
			nextCurNum = 0;
		} else {
			nextCurNum = parseInt(i) + 1;
		}
		defaultCur = allCurArray[nextCurNum];
		showBtcValue();
	}
}

// Update BTC display value
function showBtcValue() {
	console.log("CUR: " + defaultCur);
	console.log(JSON.stringify(lastBtcPrices));
	console.log(defaultCur + ": " + lastBtcPrices[defaultCur].last);
	$('#btc').html(lastBtcPrices[defaultCur].last + "&nbsp;" + defaultCur);
}
   
// Update heart rate display value only if screen is on and it has been a second since the last update
function updateHeartRate(hrmInfo) {
	checkScreen();
	if (hrmInfo.heartRate && (Math.round(Date.now() / 1000) > (lastHrUpdate + 1)) && screenOn) {
		$('#heart').html(hrmInfo.heartRate);
		lastHrUpdate = Math.round(Date.now() / 1000);
	}
	//tizen.humanactivitymonitor.stop('HRM');
}

// JQuery Document Ready
$(document).ready(function() {
	console.log('Document Ready');
	checkScreen();
	init();
});