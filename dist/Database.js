"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Database = void 0;
const Addon_1 = require("./Addon");
const fs_1 = __importDefault(require("fs"));
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const xml2js_1 = __importDefault(require("xml2js"));
const os_1 = __importDefault(require("os"));
const extract_zip_1 = __importDefault(require("extract-zip"));
const ONLINE_URL = "https://online.supertuxkart.net/dl/xml/";
const FILES_FOLDER = "files/";
const NEWS_FILE = "online_news.xml";
const ADDONS_FILE = "addons.xml";
class Database {
    karts = [];
    tracks = [];
    arenas = [];
    installed = [];
    raw;
    initialized = false;
    queue = [];
    installationFolder = "";
    async Init() {
        if (!this.initialized) {
            if (this.checkRequiredFiles()) {
                console.log("Downloading assets from server");
                await this.downloadNewsFile();
                await this.downloadAddonsFile();
            }
            await this.parseAddons();
            await this.loadInstalled();
            this.initialized = true;
        }
        return this;
    }
    AddToQueue(addon) {
        this.queue.push(addon);
    }
    async ProcessQueue() {
        for (const addon of this.queue) {
            console.log(`* Downloading zip for ${addon.id}`);
            const fileName = path_1.default.basename(addon.file);
            const zipPath = path_1.default.join(FILES_FOLDER, fileName);
            await fetch(addon.file)
                .then(res => res.arrayBuffer())
                .then((arrayBuffer) => {
                const buffer = Buffer.from(arrayBuffer);
                return promises_1.default.writeFile(zipPath, buffer);
            })
                .then(() => {
                const destFolder = this.getSubfolder(addon);
                console.log(`** Extracting to ${destFolder}`);
                return (0, extract_zip_1.default)(zipPath, { dir: destFolder, });
            })
                .catch(err => console.error(`There was an error downloading ${addon.id}: ${err}`))
                .then(() => {
                fs_1.default.rmSync(zipPath);
            });
        }
    }
    async uninstall(toRemove) {
        const index = this.installed.findIndex(addon => addon == toRemove);
        if (index >= 0) {
            //actual valid addon
            this.installed.splice(index, 1);
            const folderPath = this.getSubfolder(toRemove);
            fs_1.default.rmSync(folderPath, { recursive: true });
            console.log(`Successfully removed addon ${toRemove.id}`);
        }
    }
    AddonToString(addon) {
        const typeString = addon.type == Addon_1.AddonType.KART ? "Kart " : addon.type == Addon_1.AddonType.TRACK ? "Track" : "Arena";
        const installed = this.installed.includes(addon);
        return `${typeString}: ${installed ? "*" : " "} [${addon.id}] ${addon.name} by ${addon.designer} (Uploaded by ${addon.uploader})
    ${addon.description}`;
    }
    //PRIVATE METHODS
    async downloadNewsFile() {
        const response = await fetch(path_1.default.join(ONLINE_URL, NEWS_FILE));
        const text = await response.text();
        await promises_1.default.writeFile(path_1.default.join(FILES_FOLDER, NEWS_FILE), text);
        console.log("Written online_news.xml");
    }
    async downloadAddonsFile() {
        const newsXml = (await promises_1.default.readFile(path_1.default.join(FILES_FOLDER, NEWS_FILE))).toString();
        const news = await xml2js_1.default.parseStringPromise(newsXml);
        const url = news["news"]["include"][0]["$"]["file"];
        const response = await fetch(url);
        const text = await response.text();
        await promises_1.default.writeFile(path_1.default.join(FILES_FOLDER, ADDONS_FILE), text);
        console.log("Written addons.xml");
    }
    async parseAddons() {
        console.log("Loaded Addons from " + ADDONS_FILE);
        const xmlText = (await promises_1.default.readFile(path_1.default.join(FILES_FOLDER, ADDONS_FILE))).toString();
        const obj = await xml2js_1.default.parseStringPromise(xmlText);
        this.raw = obj["assets"];
        for (const dollarKart of this.raw["kart"]) {
            const newKart = new Addon_1.Addon(Addon_1.AddonType.KART, dollarKart);
            //this is the most absolute dogshit way to do this
            this.karts = this.karts.filter(kart => kart.id != newKart.id || kart.revision > newKart.revision);
            this.karts.push(newKart);
        }
        for (const dollarTrack of this.raw["track"]) {
            const newTrack = new Addon_1.Addon(Addon_1.AddonType.TRACK, dollarTrack);
            //this is the most absolute dogshit way to do this
            this.tracks = this.tracks.filter(track => track.id != newTrack.id || track.revision > newTrack.revision);
            this.tracks.push(newTrack);
        }
        for (const dollarArena of this.raw["arena"]) {
            const newArena = new Addon_1.Addon(Addon_1.AddonType.ARENA, dollarArena);
            //this is the most absolute dogshit way to do this
            this.arenas = this.arenas.filter(arena => arena.id != newArena.id || arena.revision > newArena.revision);
            this.arenas.push(newArena);
        }
    }
    async loadInstalled() {
        console.log("Loaded installed addons ");
        switch (os_1.default.platform()) {
            case "win32":
                this.installationFolder = path_1.default.join(process.env.APPDATA, "supertuxkart/addons");
                break;
            case "linux":
                this.installationFolder = path_1.default.join(os_1.default.homedir(), "/.local/share/supertuxkart/addons/");
                break;
        }
        //we know the folders below contain only subfolders
        const kartSubfolder = path_1.default.join(this.installationFolder, "karts");
        const trackSubfolder = path_1.default.join(this.installationFolder, "tracks");
        if (!fs_1.default.existsSync(kartSubfolder))
            await promises_1.default.mkdir(kartSubfolder);
        if (!fs_1.default.existsSync(trackSubfolder))
            await promises_1.default.mkdir(trackSubfolder);
        this.installed = [];
        await promises_1.default.readdir(kartSubfolder)
            .then(folders => {
            for (const folder of folders) {
                if (fs_1.default.existsSync(path_1.default.join(kartSubfolder, folder, "kart.xml"))) {
                    const addon = this.karts.find(kart => kart.id == folder);
                    if (addon)
                        this.installed.push(addon);
                }
            }
        });
        await promises_1.default.readdir(trackSubfolder)
            .then(folders => {
            for (const folder of folders) {
                if (fs_1.default.existsSync(path_1.default.join(trackSubfolder, folder, "track.xml"))) {
                    let addon = this.tracks.find(track => track.id == folder);
                    if (!addon)
                        addon = this.arenas.find(arena => arena.id == folder);
                    if (addon)
                        this.installed.push(addon);
                }
            }
        });
    }
    //returns true when a refresh is needed
    checkRequiredFiles() {
        if (!fs_1.default.existsSync(FILES_FOLDER)) {
            fs_1.default.mkdirSync(FILES_FOLDER);
            return true;
        }
        if (!fs_1.default.existsSync(path_1.default.join(FILES_FOLDER, NEWS_FILE)))
            return true;
        if (!fs_1.default.existsSync(path_1.default.join(FILES_FOLDER, ADDONS_FILE)))
            return true;
        return false;
    }
    getSubfolder(addon) {
        return path_1.default.join(this.installationFolder, addon.type == Addon_1.AddonType.KART ? "karts" : "tracks", addon.id);
    }
}
exports.Database = Database;
