// ==========================================
// CARREGA CACHE MANAGER
// ==========================================

function loadCacheManager() {

    var cacheManagerPath =
        Folder(
            $.fileName
        ).parent.parent.fsName +
        "/library/system/cacheManager.jsx";

    $.evalFile(cacheManagerPath);

}

// ==========================================
// RUN PRE-FLIGHT
// ==========================================
function preflightRun() {

    var cacheLibrary =
        new Folder(
            Folder.userData +
            "/TheSignPackTools/library"
        );

    var preflightFile =
        new File(
            cacheLibrary.fsName +
            "/scripts/Preflight.jsx"
        );

    $.evalFile(preflightFile);

    return PREFLIGHT.run();

}