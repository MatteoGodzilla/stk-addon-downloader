"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Addon = exports.AddonStatus = exports.AddonType = void 0;
const xml2js_1 = require("xml2js");
var AddonType;
(function (AddonType) {
    AddonType[AddonType["KART"] = 0] = "KART";
    AddonType[AddonType["TRACK"] = 1] = "TRACK";
    AddonType[AddonType["ARENA"] = 2] = "ARENA";
})(AddonType || (exports.AddonType = AddonType = {}));
//copied from supertuxkart source
var AddonStatus;
(function (AddonStatus) {
    AddonStatus[AddonStatus["APPROVED"] = 1] = "APPROVED";
    AddonStatus[AddonStatus["ALPHA"] = 2] = "ALPHA";
    AddonStatus[AddonStatus["BETA"] = 4] = "BETA";
    AddonStatus[AddonStatus["RC"] = 8] = "RC";
    AddonStatus[AddonStatus["INVISIBLE"] = 16] = "INVISIBLE";
    //HQ       = 0x0020,   currently not supported
    AddonStatus[AddonStatus["DFSG"] = 64] = "DFSG";
    AddonStatus[AddonStatus["FEATURED"] = 128] = "FEATURED";
    AddonStatus[AddonStatus["LATEST"] = 256] = "LATEST";
    AddonStatus[AddonStatus["BAD_DIM"] = 512] = "BAD_DIM";
    AddonStatus[AddonStatus["LAST"] = 512] = "LAST";
})(AddonStatus || (exports.AddonStatus = AddonStatus = {}));
class Addon {
    type;
    id = "";
    name = "";
    file = "";
    date = 0;
    uploader = "";
    designer = "";
    description = "";
    image = "";
    icon = "";
    format = 0;
    revision = 0;
    status = [];
    size = 0;
    minVersion = 0;
    maxVersion = 0;
    license = "";
    imageList = "";
    rating = 0;
    raw;
    constructor(t, dollarObject) {
        this.type = t;
        this.id = dollarObject["$"]["id"];
        this.name = dollarObject["$"]["name"];
        this.file = dollarObject["$"]["file"];
        this.date = Number(dollarObject["$"]["date"]);
        this.uploader = dollarObject["$"]["uploader"];
        this.designer = dollarObject["$"]["designer"];
        this.description = dollarObject["$"]["description"];
        this.image = dollarObject["$"]["image"];
        this.icon = dollarObject["$"]["icon"];
        this.format = Number(dollarObject["$"]["format"]);
        this.revision = Number(dollarObject["$"]["revision"]);
        const statusNum = Number(dollarObject["$"]["status"]);
        //because typescript enums are annoying to iterate
        for (let i = 1; i <= AddonStatus.LAST; i *= 2) {
            if ((statusNum & i) > 0) {
                this.status.push(i);
            }
        }
        this.size = Number(dollarObject["$"]["size"]);
        this.minVersion = dollarObject["$"]["min-include-version"];
        this.maxVersion = dollarObject["$"]["max-include-version"];
        this.license = dollarObject["$"]["licence"];
        this.rating = Number(dollarObject["$"]["rating"]);
        this.raw = dollarObject;
    }
    toXML() {
        const rootName = this.type == AddonType.KART ? "kart" : this.type == AddonType.TRACK ? "track" : "arena";
        const builder = new xml2js_1.Builder({ attrkey: '$', rootName, headless: true });
        return builder.buildObject(this.raw);
    }
}
exports.Addon = Addon;
