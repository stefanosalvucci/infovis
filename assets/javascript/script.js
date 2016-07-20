var tip = d3.tip()
    .attr('class', 'd3-tip')
    .offset([-10, 0])
    .html(function(d) {
        return "<strong>RFC:</strong> <span style='color:#"+d.color+"'>"+ d.name +"</span>";
    })

// sizing information, including margins so there is space for labels, etc
var margin =  { top: 100, right: 0, bottom: 250, left: 40 },
    width = 1260 - margin.left - margin.right,
    height = 800 - margin.top - margin.bottom,
    marginOverview = { top: 570, right: margin.right, bottom: 20,  left: margin.left },
    heightOverview = 100;

// set up a date parsing function for future use
var parseDate = d3.time.format("%d/%B/%Y").parse;
var maxRfcReleaseDate;

// mathematical scales for the x and y axes
var x = d3.scale.linear()
                .range([0, width]);
var y = d3.time.scale()
                .range([height, 0]);
var xOverview = d3.scale.linear()
                .range([0, width]);
var yOverview = d3.time.scale()
                .range([heightOverview, 0]);

// rendering for the x and y axes
var xAxis = d3.svg.axis()
                .scale(x)
                .orient("bottom");
var yAxis = d3.svg.axis()
                .scale(y)
                .orient("left");
var xAxisOverview = d3.svg.axis()
                .scale(xOverview)
                .orient("bottom");

// something for us to render the chart into
var svg = d3.select("body")
                .append("svg") // the overall space
                    .attr("width", width + margin.left + margin.right)
                    .attr("height", height + margin.top + margin.bottom);
var main = svg.append("g")
                .attr("class", "main")
                .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
var overview = svg.append("g")
                    .attr("class", "overview")
                    .attr("transform", "translate(" + marginOverview.left + "," + marginOverview.top + ")");

svg.call(tip);

// brush tool to let us zoom and pan using the overview chart
var brush = d3.svg.brush()
                  .x(xOverview)
                  .on("brush", brushed);

// setup complete, let's get some data!
d3.json("source/rfc.json", function(error, data) {

    maxRfcReleaseDate = maxDate(data);

    // data ranges for the x and y axes
    x.domain(d3.extent(Object.keys(data), function(el){return parseInt(el)}));

    y.domain(d3.extent(datesFromSource(dataFromSource(data))));
    // y.domain([parseDate("1/1/1950"), maxRfcReleaseDate]);
    xOverview.domain(x.domain());
    yOverview.domain(y.domain());

    // draw the bars
    main.append("svg").append("g")
            .attr("class", "bars")
            // a group for each stack of bars, positioned in the correct x position
            .selectAll(".bar.stack")
              .data(dataFromSource(data))
              .enter().append("g")
                .attr("class", "bar stack")
                .attr("id", function(el) {return el.id})
                .attr("transform", function(el) { return "translate(" + x(el.id) + ",0)"; })
            // a bar for each value in the stack, positioned in the correct y positions
            .selectAll("rect")
              .data(function(d){return d.counts})
              .enter().append("rect")
                .attr("class", "bar")
                .attr("width", 6)
                .attr("y", function(d) { return y(d.y1) })
                .attr("height", function(d) { return dateDiff(d.name, d.y0, d.y1, y)})
                .style("fill", function(d) { return d.color })
                .on('mouseover', tip.show)
                .on('mouseout', tip.hide)
                .on('click', function(d){
                  $('#modal-inner-html').html('<a target="_blank" href="https://tools.ietf.org/html/rfc' + d.name + '">' + d.title + '</a>');
                  $('#rfc-details').modal('show');
                })

    // draw the axes now that they are fully set up
    main.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + height + ")")
        .call(xAxis);
    main.append("g")
        .attr("class", "y axis")
        .call(yAxis);
    overview.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + heightOverview + ")")
        .call(xAxisOverview);

    overview.append("g")
            .attr("class", "bars")
            .selectAll(".bar")
              .data(dataFromSource(data))
              .enter().append("rect")
                .attr("class", "bar")
                .attr("x", function(d) { return xOverview(d.id)})
                .attr("width", 6)
                .attr("y", function(d) { return yOverview(maxRfcReleaseDate) })
                .attr("height", function(d) { return dateDiff(d.id , d.date, maxRfcReleaseDate, yOverview) });

    // add the brush target area on the overview chart
    overview.append("g")
            .attr("class", "x brush")
            .call(brush)
            .selectAll("rect")
              // -6 is magic number to offset positions for styling/interaction to feel right
              .attr("y", -6)
              // need to manually set the height because the brush has
              // no y scale, i.e. we should see the extent being marked
              // over the full height of the overview chart
              .attr("height", heightOverview + 7);  // +7 is magic number for styling

});

function maxDate(data) {
    var max = parseDate("1/July/1900");
    keys = Object.keys(data);
    for (key in keys){
        el = data[keys[key]];
        if (el != "Not Issued") {
            currentDate = dateFromRFC(el);
            if (max < currentDate){
                max = currentDate;
            }
        }
    }
    return max;
};

function dateFromRFC(el) {
    return parseDate("01/"+ el['issue_data']['month'] + '/' + el['issue_data']['year'])
}

function datesFromSource(data){
    var dates = []
    for (var el in data) {
      dates.push(data[el].date);
    }
    return dates;
}

function dataFromSource(data){
    keys = Object.keys(data);
    var rfcs = [];
    for (key in keys){
        el = data[keys[key]];
        if (el != "Not Issued" && el.obsolets == null) {
            rfcs.push({
                id: keys[key],
                date: dateFromRFC(el),
                counts: countsCalculator(keys[key], el, data)
            });
        }
    }
    return rfcs;
}

function dateDiff(id, d1, d2, yScale){
    var result =  yScale(d1) - yScale(d2);
    return result;
}

function deleteDuplicated(array) {
    var a = array.concat();
    for(var i=0; i<a.length; ++i) {
        for(var j=i+1; j<a.length; ++j) {
            if(a[i] === a[j])
                a.splice(j--, 1);
        }
    }

    return a;
}

function countsCalculator(key, el, data){
    var last_count = { name: key, y0: dateFromRFC(el), y1: maxRfcReleaseDate, color: "008125", title: titleFromRFC(el) }
    var counts = [ last_count ];
    if (el.obsoleted_by != null) {
        var obsoleted = deleteDuplicated(retrieveObsoletedRFC(el.obsoleted_by, data));
        var countsLength = obsoleted.length;
        var colorScale = createColorScale(countsLength+1);
        last_count.color = colorScale[0];
        var sortedObsoleted = obsoleted.sort(function(x,y){
            var rfc1 =  x.replace("RFC", "");
            var rfc2 =  y.replace("RFC", "");
            var new_el1 = data[rfc1];
            var new_el2 = data[rfc2];
            var new_date1 = dateFromRFC(new_el1);
            var new_date2 = dateFromRFC(new_el2);
            return new_date1 > new_date2
        })
        for (var i = 0; i < countsLength; i++) {
            var obs =  sortedObsoleted[i].replace("RFC", "");
            var new_el = data[obs];
            var new_date = dateFromRFC(new_el);
            last_count.y1 = new_date;
            last_count = { name: obs, y0: new_date, y1: maxRfcReleaseDate, color: colorScale[i+1], title: titleFromRFC(new_el)};
            counts.push(last_count);
        }
    }
    return counts;
}

function retrieveObsoletedRFC(node, data){
    var countsLength = node.length;
    var obsoleted = [];
    for (var i = 0; i < countsLength; i++) {
        var rfc =  node[i].replace("RFC", "");
        var new_el = data[rfc];
        if (rfc.obsoleted_by == null){
            obsoleted = obsoleted.concat(rfc);
        }else{
            obsoleted = obsoleted.concat(retrieveObsoletedRFC(new_el.obsoleted_by, data));
        }
    }
    return obsoleted;
}

function titleFromRFC(el){
    return el['title'];
}

function createColorScale(length){
    color = ["FF0718"]; //red
    if (length==3){
        color.push("FDFC56");
    }
    if (length==4) {
        color.push("FFD248");
        color.push("CEE64C");
    }
    if (length==5) {
        color.push("FF8931");
        color.push("FDFC56");
        color.push("A6D345");
    }
    if (length==6) {
        color.push("BBDD49");
        color.push("EEF553");
        color.push("FFE84F");
        color.push("FFCA45");
    }
    if (length==7) {
        color.push("FFAE3C");
        color.push("FFDB4B");
        color.push("FDFC56");
        color.push("E1F050");
        color.push("ABD646");
    }
    color.push("008125"); //green

    return color;
}

// zooming/panning behaviour for overview chart
function brushed() {
    // update the main chart's x axis data range
    x.domain(brush.empty() ? xOverview.domain() : brush.extent());
    // redraw the bars on the main chart
    main.selectAll(".bar.stack")
            .attr("transform", function(d) { return "translate(" + x(d.id) + ",0)"; })
    // redraw the x axis of the main chart
    main.select(".x.axis").call(xAxis);
}