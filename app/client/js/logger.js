function notify(message, type = "info"){

    const bar =
        document.getElementById("statusBar");

    if(!bar)
        return;

    const notification =
        document.createElement("div");

    notification.className =
        "status " + type;

    notification.textContent =
        message;

    bar.appendChild(notification);


    setTimeout(function(){

        notification.remove();

    }, 5000);

}