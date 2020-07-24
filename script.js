// https://github.com/tensorflow/tensorboard/pull/639/files
function smooth(values, weight) {
    weight = Math.min(Math.max(weight, 0), 1);

    let last = 0;
    let num_accum = 0;
    var smoothed = [];

    values.forEach(val => {
        last = weight * last + (1 - weight) * val;
        num_accum++;
        let debias_weight = (weight == 1.0) ? 1.0 : 1.0 - Math.pow(weight, num_accum);
        smoothed.push(last / debias_weight);
    });
    
    return smoothed;
}


function plot_all(plots_data, filters = {}) {
    data_to_plot = {};

    $("#plots").html("");
    var n_runs = 0;

    plots_data.forEach(plot => {

        if ("runs_or" in filters && filters.runs_or.length > 0 && filters.runs_or.every(function(element, index) { return !plot.filename.includes(element); }))
            return;
        if ("runs_and" in filters && filters.runs_and.length > 0 && filters.runs_and.some(function(element, index) { return !plot.filename.includes(element); }))
            return;

        n_runs++;
        $("#n_runs").text(n_runs);

        csv_array = plot.contents
        var data = {};
        for (i = 0; i < csv_array[0].length; i++) {
            let header = csv_array[0][i];

            if ("metrics_or" in filters && filters.metrics_or.length > 0 && filters.metrics_or.every(function(element, index) { return !header.includes(element); }))
                continue;
            if ("metrics_and" in filters && filters.metrics_and.length > 0 && filters.metrics_and.some(function(element, index) { return !header.includes(element); }))
                continue;

            data[header] = [];
            for (j = 1; j < csv_array.length; j++) {
                data[header].push(csv_array[j][i]);
            }

            if (!(header in data_to_plot)) {
                data_to_plot[header] = [];
            }
            data_to_plot[header].push({
                'name': plot.filename,
                'clean_name': plot.filename.replace(/[^A-Za-z0-9]/g, '_'),
                'y': data[header],
                'x': data['training_iteration']
            });
        }

        plot.data = data;
    });

    var count_metrics = 0

    // console.log(Object.keys(data));
    Object.keys(data_to_plot).forEach(header => {

        count_metrics++;
        $("#n_metrics").text(count_metrics);

        if (!isNaN(parseFloat(data_to_plot[header][0].y[0]))) {
            var traces = [];
            data_to_plot[header].forEach(values => {
                traces.push({
                    x: values.x,
                    y: smooth(values.y, filters.smoothing_val),
                    name: "",  // values.clean_name,
                    display_name: values.name.split('/').slice(-3, -1).join('/')
                });
            });

            var layout = {
                title: header,
                xaxis: { title: 'iterations' },
                showlegend: false
            }
            
            let div_id = header.replace(/[^A-Za-z0-9]/g, '_');
            $('#plots').append('<div id="' + div_id + '"></div>');
            Plotly.newPlot($('#' + div_id)[0], traces, layout);

            $('#' + div_id)[0].on('plotly_hover', function(data) {
                data.points.sort(function(a, b) { return b.y - a.y; });
                
                $('#info tbody').html("");

                $('#info').stop();
                $('#info').fadeIn({duration: 200, queue: false});

                var nb = 0;

                data.points.forEach(pt => {
                    if (nb < 10) {
                        $('#info tbody').append(
                            `<tr>
                                <td><span class="dot" style="background-color: ` + pt.fullData.line.color + `"></span></td>  
                                <td>` + pt.y.toFixed(3) + `</td>  
                                <td>` + pt.x + `</td>  
                                <td>` + pt.data.display_name + `</td>                    
                            </tr>
                        `);
                    }
                    if (nb == 10) {
                        $('#info tbody').append(
                            `<tr>
                                <td></td>  
                                <td>...</td>  
                                <td></td>  
                                <td></td>                    
                            </tr>
                        `);
                        
                    } 
                    nb++;
                });
            
            })
            .on('plotly_unhover', function(data) {
                if (!$('#info').is(":hover")) {
                    $('#info').stop();
                    $('#info').fadeOut({duration: 200, queue: false});
                }
            });

            $('#info').mouseleave(function() {
                $('#info').stop();
                $('#info').fadeOut({duration: 200, queue: false});
            });
        }
    });
}


$(document).ready(function() {

    var request = $.ajax({
        type: "GET",  
        url: "get_csv_paths",
        dataType: "text"
    });

    $.when(request).done(function(csv_paths_str) {
        var count_loaded = 0;

        var csv_paths = csv_paths_str.split('\n');
        var requests = [];
        csv_paths.forEach(path => {
            requests.push($.ajax({
                type: "GET",
                url: "get_csv_file/" + path,
                dataType: "text",
                beforeSend: function(args) {
                    args.filename = path;
                },
                complete: function(_, _) {
                    count_loaded += 1;
                    $("#n_loaded").text(count_loaded);
                }
            }));
        });

        $.when.apply(this, requests).done(function() {
            plots_data = [];
            for (i = 0; i < arguments.length; i++) {
                plots_data.push({
                    'contents': $.csv.toArrays(arguments[i][0]),
                    'filename': arguments[i][2]['filename']
                });
            }

            let handle_filters = function() {
                let filters = {};
                filters["metrics_" + $("#metrics_selector").val()] = $("#metrics").val().split(" ");
                filters["runs_" + $("#runs_selector").val()] = $("#runs").val().split(" ");
                filters["smoothing_val"] = $("#smoothing_slider").val() / 100;
                plot_all(plots_data, filters);
            };
            
            handle_filters();

            var timer = null;
            $("#metrics").keyup(function() { 
                clearTimeout(timer); 
                timer = setTimeout(handle_filters, 400)
            });
            $("#runs").keyup(function() { 
                clearTimeout(timer); 
                timer = setTimeout(handle_filters, 400)
            });
            $("#metrics_selector").change(handle_filters);
            $("#runs_selector").change(handle_filters);
            $("#smoothing_slider").change(function() {
                $("#smoothing_value").text($("#smoothing_slider").val() / 100);
                handle_filters();
            });
        });

    });
});
