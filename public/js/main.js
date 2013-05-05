jQuery(function($) {
    $("form:has(input[data-disable-with])").submit(function() {
        $(this).find("input[data-disable-with]").each(function() {
            $(this).data("enable-with", $(this).val())
                   .attr("value", $(this).attr("data-disable-with"))
                   .attr("disabled", "disabled");
        });
    });
});
