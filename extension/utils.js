function getISODate(t) {

    z = t.getTimezoneOffset() * 60 * 1000
    //subtract the offset from t
    tLocal = t - z
    //create shifted Date object
    tLocal = new Date(tLocal)
    //convert to ISO format string
    var nowISO = tLocal.toISOString().substring(0, 10);
    return nowISO;
}

function getDayDifference(isoDateStr) {
    //returns the number of days between the supplied date and now
    const now = new Date();
    const target = new Date(isoDateStr);

    // Zero out the time parts so it's date-only comparison
    now.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);

    const diffInMs = now - target; // will be negative if target is in the future
    const diffInDays = Math.round(diffInMs / (1000 * 60 * 60 * 24));

    return diffInDays;
}

function getDatestampColour(humanReadableDate, intensity = "99") {
    const dt = new Date(humanReadableDate);
    const now = new Date();
    const muchLater = new Date(now);
    muchLater.setFullYear(now.getFullYear() + 99);

    let dtISO;
    if (dt && dt != "Invalid Date") {
        //console.log("parse date...", humanReadableDate, dt);
        dtISO = getISODate(dt);
    }

    var age = getDayDifference(dtISO);
    var col = "";
    if (age > 0) {
        if (age > 1000) {return "#ff0000" + intensity;}
        if (age > 200) { age = 200; };
        const blu = 255 - age;
        col = "#2222" + blu.toString(16).padStart(2, '0') + intensity;
        //console.log("age",age, col)
    } else {
        col = "#008800" + intensity; //green to show future
    }
    return col;
}

// -------------------- Color Helper --------------------
function numberToColor(num, alpha = 0.5) {
    if (num === 'x') return `rgba(180,180,180,0.3)`; // grey for done
    let normalized = num / 99;
    if (num < 0 || num > 99) return `rgba(60,60,60,0.3)`;

    let red = 0, green = 0, blue = 0;
    if (normalized < 0.25) {
        red = 255; green = Math.round(normalized * 4 * 150); blue = 0;
    } else if (normalized >= 0.25 && normalized < 0.5) {
        red = 255 - Math.round((normalized - 0.25) * 4 * 255);
        green = 150; blue = 0;
    } else if (normalized > 0.5 && normalized < 0.75) {
        red = 0; green = 150; blue = Math.round((normalized - 0.5) * 4 * 255);
    } else if (normalized > 0.75) {
        red = 0; green = 150 - Math.round((normalized - 0.75) * 4 * 150); blue = 255;
    }

    return `rgba(${red},${green},${blue},${alpha})`;
}



module.exports = {
    getDayDifference, getDatestampColour, numberToColor, getISODate
};

