function parseXmltvDate(dateStr) {
    if (!dateStr) return new Date();

    const match = dateStr.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?\s*([+-]\d{4})?/);
    if (!match) return new Date();

    const year = parseInt(match[1]);
    const month = parseInt(match[2]) - 1;
    const day = parseInt(match[3]);
    const hour = parseInt(match[4]);
    const min = parseInt(match[5]);
    const sec = match[6] ? parseInt(match[6]) : 0;
    
    const offsetStr = match[7];
    const date = offsetStr 
        ? new Date(Date.UTC(year, month, day, hour, min, sec)) 
        : new Date(year, month, day, hour, min, sec);

    if (offsetStr && offsetStr.length >= 5) {
        const sign = offsetStr[0] === '+' ? 1 : -1;
        const offsetHours = parseInt(offsetStr.substring(1, 3));
        const offsetMins = parseInt(offsetStr.substring(3, 5));
        const totalOffsetMin = (offsetHours * 60 + offsetMins) * sign;

        date.setMinutes(date.getMinutes() - totalOffsetMin);
    }
    
    return date;
}

function parseXmltvDateFixed(dateStr) {
    if (!dateStr) return new Date();

    const match = dateStr.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?\s*([+-]\d{4})?/);
    if (!match) return new Date();

    const year = parseInt(match[1]);
    const month = parseInt(match[2]) - 1;
    const day = parseInt(match[3]);
    const hour = parseInt(match[4]);
    const min = parseInt(match[5]);
    const sec = match[6] ? parseInt(match[6]) : 0;
    
    const offsetStr = match[7];
    const date = offsetStr 
        ? new Date(Date.UTC(year, month, day, hour, min, sec)) 
        : new Date(year, month, day, hour, min, sec);

    if (offsetStr && offsetStr.length >= 5) {
        const sign = offsetStr[0] === '+' ? 1 : -1;
        const offsetHours = parseInt(offsetStr.substring(1, 3));
        const offsetMins = parseInt(offsetStr.substring(3, 5));
        const totalOffsetMin = (offsetHours * 60 + offsetMins) * sign;

        // FIXED: Use UTC methods
        date.setUTCMinutes(date.getUTCMinutes() - totalOffsetMin);
    }
    
    return date;
}

const test1 = "20260318073000 -0600"; // 07:30 Mexico
console.log("Original parseXmltvDate:", parseXmltvDate(test1).toUTCString(), "Local:", parseXmltvDate(test1).toString());
console.log("Fixed parseXmltvDate:", parseXmltvDateFixed(test1).toUTCString(), "Local:", parseXmltvDateFixed(test1).toString());

const test2 = "20260318073000"; // No offset
console.log("No offset parseXmltvDate:", parseXmltvDate(test2).toString());
console.log("No offset Fixed parseXmltvDate:", parseXmltvDateFixed(test2).toString());
