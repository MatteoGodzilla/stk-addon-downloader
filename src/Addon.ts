import { Builder } from "xml2js";

export enum AddonType {
    KART,
    TRACK,
    ARENA
}

//copied from supertuxkart source
export enum AddonStatus {
    APPROVED = 0x0001,
    ALPHA = 0x0002,
    BETA = 0x0004,
    RC = 0x0008,
    INVISIBLE = 0x0010,
    //HQ       = 0x0020,   currently not supported
    DFSG = 0x0040,
    FEATURED = 0x0080,
    LATEST = 0X0100,
    BAD_DIM = 0x0200,
    LAST = BAD_DIM
}

export class Addon {
    type: AddonType;
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
    status : AddonStatus[] = [];
    size = 0;
    minVersion = 0;
    maxVersion = 0;
    license = "";
    imageList = "";
    rating = 0;
    private raw: any;

    constructor(t: AddonType, dollarObject: any) {
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
        for(let i = 1; i <= AddonStatus.LAST; i *= 2){
            if((statusNum & i) > 0){
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
        const builder = new Builder({ attrkey: '$', rootName, headless: true });
        return builder.buildObject(this.raw);
    }
}