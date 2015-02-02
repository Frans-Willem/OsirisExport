/*
 * Osiris Export door Frans-Willem Hardijzer (fw@hardijzer.nl, 14-04-2014)
 * ======================================================
 * Disclaimer
 * ----------
 * Ik doe geen garanties over de werking of veiligheid van dit script.
 * Gebruik is volledig op eigen risisco
 * Als het niet werkt mag je mailen, maar ik beloof geen reactie.
 * Als het wel werkt, laat het gerust weten ;)
 *
 * Hoe te gebruiken?
 * -----------------
 * - Kopieer deze volledig tekst naar je clipboard
 * - Start Chrome
 * - Log in op Osiris (http://www.uu.nl/osirisstudent/)
 * - Ga naar 'Rooster'
 * - Klik op 'Totaalrooster'
 * - Druk op Control + Shift + J
 * - Plak dit script in het venster dat beneden aan je browser opent (Control+V)
 * - Druk op Enter
 * - Klik op de link die verschijnt
 * - Sla het bestand op
 * - Ga naar Google Calendar
 * - Ga naar Instellingen (onder het tandwieltje rechts-boven)
 * - Ga naar Agenda's (bovenin)
 * - Klik op "Agenda importeren" (naast "Nieuwe agenda maken" knop)
 * - Zoek je opgeslagen osiris.ical bestand
 * - Selecteer in welke agenda
 * - Klik op "Importeren"
 * - Klaar!
 *
 * Updates
 * -------
 * - (14-04-2014) Rij-herkenning geupdate, getest met Informatica en Pedagogiek vakken.
 *    Meer vakken zouden nu herkend moeten worden, en werkgroep-groep verschijnt nu ook in je agenda.
 */
(function () {
	"use strict";
	function toArray(nodelist) {
		return Array.prototype.slice.call(nodelist, 0);
	}
	function textContent(cell) {
		if (cell.nodeType === cell.TEXT_NODE) {
			return cell.data;
		}
		if (cell.nodeType === cell.ELEMENT_NODE) {
			if (cell.tagName === "BR") {
				return "\n";
			}
			return toArray(cell.childNodes).map(textContent).join("");
		}
		return "";
	}
	function isEmptyText(txt) {
		return (/^[\n\t ]*$/).test(txt);
	}
	function parseTimes(times) {
		var re = /([0-9]{2})[:\.]([0-9]{2})/g,
			ret = [],
			m;
		while ((m = re.exec(times)) !== null) {
			ret.push({hour:parseInt(m[1],10),minute:parseInt(m[2],10)});
		}
		return ret;
	}
	function tableToArray(table) {
		return toArray(table.rows).map(function (row) {
			return toArray(row.cells);
		});
	}
	function parseWhen(cell) {
		var table = toArray(cell.children).filter(function (child) { return child.tagName === "TABLE"; })[0];
		if (!table) {
			return {};
		}
		var data = tableToArray(table).map(function (row) { return row.map(textContent); });
		var day = data[0][0],
			daynum = parseInt(data[0][1], 10),
			times = parseTimes(data[0][2]);
		return {
			day: isEmptyText(day)?undefined:day,
			daynum: isNaN(daynum)?undefined:daynum,
			times: times
		};
	}
	function classifyRow(cells) {
		var celltexts = cells.map(textContent),
			emptycells = celltexts.map(function(txt) { return isEmptyText(txt); }),
			when = parseWhen(cells[0]);
		if (emptycells.every(function(x) { return x; })) {
			return {rowtype:"Spacing"};
		}
		if (!emptycells[0] && emptycells.slice(1).every(function(x) { return x; })) {
			return {rowtype:"Month", month: celltexts[0]};
		}
		if (when && when.times !== undefined) {
			return {
				rowtype: "Block",
				when: when,
				courseid: celltexts[1],
				coursename: celltexts[3],
				type: celltexts[5],
				group: celltexts[7],
				building: celltexts[9],
				room: celltexts[11]
			};
		}
		return {rowtype:"Unknown", cells: cells, texts: celltexts};
	}
	function propagateMonth(data) {
		data.reduce(function (month, row) {
			if (row.rowtype === "Month") {
				return row.month;
			}
			if (row.rowtype === "Block") {
				row.when.month = month;
			}
			return month;
		}, undefined);
	}
	function propagateDay(data) {
		data.reduce(function (propagate, row) {
			if (row.rowtype === "Block") {
				if (row.when.day !== undefined) {
					propagate.day = row.when.day;
				} else {
					row.when.day=propagate.day;
				}
				if (row.when.daynum !== undefined) {
					propagate.daynum = row.when.daynum;
				} else {
					row.when.daynum=propagate.daynum;
				}
			}
			return propagate;
		}, {day:undefined, daynum:undefined});
	}
	function pad(input, length, prefix) {
		while (input.length < length) {
			input = prefix + input;
		}
		return input;
	}
	function createTime(when, index) {
		var months = ["Jan","Feb","Maa","Apr","Mei","Jun","Jul","Aug","Sep","Okt","Nov","Dec"];
		var monthnum = months.map(function (pre) { return when.month.indexOf(pre) === 0; }).indexOf(true);
		var now = new Date();
		var year = now.getFullYear();
		if (new Date(year, monthnum, when.daynum, 23, 59, 59) < now) {
			year++;
		}
		return new Date(year, monthnum, when.daynum, when.times[index].hour, when.times[index].minute, 0);
	}
	function formatDateCsv(date) {
		return pad(String(date.getFullYear()),4,"0")+"/"+pad(String(date.getMonth()+1),2,"0")+"/"+pad(String(date.getDate()),2,"0");
	}
	function formatTimeCsv(date) {
		var ampm = "AM",
			hour = date.getHours(),
			minute = date.getMinutes();
		if (hour === 0) {
			hour = 12;
		} else if (hour === 12) {
			ampm = "PM";
		} else if (hour > 12) {
			ampm = "PM";
			hour -= 12;
		}
		return pad(String(hour),2,"0") + ":" + pad(String(minute),2,"0") + ":00 "+ampm;
	}
	
	function formatDateIcal(date) {
		return pad(String(date.getUTCFullYear()),4,"0") + pad(String(date.getUTCMonth()+1),2,"0") + pad(String(date.getUTCDate()),2,"0") + "T" + pad(String(date.getUTCHours()),2,"0") + pad(String(date.getUTCMinutes()),2,"0")+pad(String(date.getSeconds()),2,"0") + "Z";
	}

	function formatRowCsv(row) {
		var startDate = createTime(row.when, 0),
			endDate = createTime(row.when, 1),
			groupInfo = (row.group !== "")?(" ("+row.group+")"):"";
		return [
			row.type + " " + row.coursename + "(" + row.courseid + ")",
			formatDateCsv(startDate),
			formatTimeCsv(startDate),
			formatDateCsv(endDate),
			formatTimeCsv(endDate),
			"False",
			row.type + groupInfo + " " + row.coursename + ": https://www.osiris.universiteitutrecht.nl/osistu_ospr/OnderwijsCatalogusToonCursusDirect.do?cursuscode=" + row.courseid,
			row.building+" "+row.room,
			"True"
		];
	}
	
	function formatRowIcal(row) {
		var startDate = createTime(row.when, 0),
			endDate = createTime(row.when, 1),
			groupInfo = (row.group !== "")?(" ("+row.group+")"):"";
		return [
			"BEGIN:VEVENT",
			"UID:" + [row.type,row.courseid,formatDateIcal(startDate)].map(function(s) {return String(s).toUpperCase(); }).join("_").replace(/[^0-9a-zA-Z]/g,"_") + "@osirisexport.fw.hardijzer.nl",
			"DTSTAMP:" + formatDateIcal(startDate),
			"DTSTART:" + formatDateIcal(startDate),
			"DTEND:" + formatDateIcal(endDate),
			"SUMMARY:" + row.type + " " + row.coursename + " (" + row.courseid + ")",
			"DESCRIPTION:" + row.type + groupInfo + " " + row.coursename + ": https://www.osiris.universiteitutrecht.nl/osistu_ospr/OnderwijsCatalogusToonCursusDirect.do?cursuscode=" + row.courseid,
			"LOCATION:" + row.building + " " + row.room,
			"STATUS:TENTATIVE",
			"TRANSP:OPAQUE",
			"END:VEVENT"
		];
	}
	
	var rows = tableToArray(document.querySelector("table.OraTableContent"));
	rows = rows.map(function(row) { return classifyRow(row); });
	propagateMonth(rows);
	propagateDay(rows);
	rows = rows.filter(function (row) { return row.rowtype === "Block"; });
	var data;
	var type = "ical";
	if (type === "csv") {
		var headerCsv = [
			"Subject",
			"Start Date",
			"Start Time",
			"End Date",
			"End Time",
			"All Day Event",
			"Description",
			"Location",
			"Private"];
		var rowsCsv = rows.map(formatRowCsv);
		data = headerCsv.join(",")+"\r\n"+rowsCsv.map(function(row) { return row.map(function(cell) { if (cell.indexOf(",") !== -1) { return "\"" + cell +"\""; } return cell; }).join(","); }).join("\r\n");
	}
	if (type === "ical") {
		var rowsIcal = rows.map(formatRowIcal);
		var headerIcal = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Frans-Willem Hardijzer//OsirisExport 1.0//NL"].join("\r\n");
		var footerIcal = ["END:VCALENDAR"].join("\r\n");
		data = [headerIcal,rowsIcal.map(function (row) { return row.join("\r\n"); }).join("\r\n"),footerIcal].join("\r\n");
	}
	//console.log(data);
	
	var url = window.URL.createObjectURL(new Blob([data],{type:"text/"+type}));
	var div = document.getElementById("__osirisExport");
	if (div) {
		div.parentNode.removeChild(div);
	}
	div = document.createElement("div");
	div.id = "__osirisExport";
	div.style.position = "absolute";
	div.style.left=div.style.top=div.style.right=div.style.bottom="0px";
	div.style.backgroundColor="#FFFFFF";
	div.style.textAlign="center";
	div.style.fontSize = "64px";
	
	var a = document.createElement("a");
	a.download="osiris."+type;
	a.href = url;
	a.appendChild(document.createTextNode("Download " + type.toUpperCase()));
	a.onclick = function () {
		document.body.removeChild(div);
		return true;
	};
	div.appendChild(a);
	
	document.body.appendChild(div);
	window.scrollTo(0);
}());
