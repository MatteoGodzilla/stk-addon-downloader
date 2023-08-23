"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Database = void 0;
const Addon_1 = require("./Addon");
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const xml2js_1 = __importDefault(require("xml2js"));
const os_1 = __importDefault(require("os"));
const https_1 = require("https");
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
    async Init(forceRefresh) {
        if (!this.initialized) {
            forceRefresh = forceRefresh || this.checkRequiredFiles();
            if (forceRefresh) {
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
    webRequest(url) {
        return new Promise((resolve, _) => {
            (0, https_1.get)(url, (res) => {
                if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    this.webRequest(res.headers.location).then(resolve);
                }
                else {
                    resolve(res);
                }
            });
        });
    }
    AddToQueue(addon) {
        this.queue.push(addon);
    }
    async ProcessQueue() {
        const promises = [];
        for (const addon of this.queue) {
            promises.push(new Promise((resolve, reject) => {
                console.log(`* Installing ${addon.id}`);
                const fileName = path_1.default.basename(addon.file);
                const zipPath = path_1.default.join(FILES_FOLDER, fileName);
                const fileStream = (0, fs_1.createWriteStream)(zipPath);
                this.webRequest(addon.file).then((res) => {
                    res.on("data", (chunk) => {
                        fileStream.write(chunk);
                    });
                    res.on("end", async () => {
                        fileStream.close();
                        const destFolder = this.getSubfolder(addon);
                        console.log(`Extracting to ${destFolder}`);
                        (0, extract_zip_1.default)(zipPath, { dir: destFolder }).then(resolve).catch(reject);
                    });
                    res.on("error", (err) => {
                        console.error(`There was an error installing ${addon.id}: ${err}`);
                        reject();
                    });
                });
            }));
        }
        return Promise.allSettled(promises);
    }
    async uninstall(toRemove) {
        const index = this.installed.findIndex(addon => addon == toRemove);
        if (index >= 0) {
            //actual valid addon
            this.installed.splice(index, 1);
            const folderPath = this.getSubfolder(toRemove);
            (0, fs_1.rmSync)(folderPath, { recursive: true });
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
        const response = await fetch(ONLINE_URL + NEWS_FILE);
        const text = await response.text();
        (0, fs_1.writeFileSync)(FILES_FOLDER + NEWS_FILE, text);
        console.log("Written online_news.xml");
    }
    async downloadAddonsFile() {
        const newsXml = (0, fs_1.readFileSync)(FILES_FOLDER + NEWS_FILE).toString();
        const news = await xml2js_1.default.parseStringPromise(newsXml);
        const url = news["news"]["include"][0]["$"]["file"];
        const response = await fetch(url);
        const text = await response.text();
        (0, fs_1.writeFileSync)(FILES_FOLDER + ADDONS_FILE, text);
        console.log("Written addons.xml");
    }
    async parseAddons() {
        console.log("Loaded Addons from " + ADDONS_FILE);
        const xmlText = (0, fs_1.readFileSync)(FILES_FOLDER + ADDONS_FILE).toString();
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
        if (!(0, fs_1.existsSync)(kartSubfolder))
            (0, fs_1.mkdirSync)(kartSubfolder);
        if (!(0, fs_1.existsSync)(trackSubfolder))
            (0, fs_1.mkdirSync)(trackSubfolder);
        const installedKartIds = (0, fs_1.readdirSync)(kartSubfolder);
        const installedTrackIds = (0, fs_1.readdirSync)(trackSubfolder);
        const kartsInstalled = this.karts.filter(kart => installedKartIds.includes(kart.id));
        const tracksInstsalled = this.tracks.filter(track => installedTrackIds.includes(track.id));
        const arenasInstalled = this.arenas.filter(arena => installedTrackIds.includes(arena.id));
        this.installed = kartsInstalled.concat(tracksInstsalled).concat(arenasInstalled);
    }
    //returns true when a refresh is needed
    checkRequiredFiles() {
        if (!(0, fs_1.existsSync)(FILES_FOLDER)) {
            (0, fs_1.mkdirSync)(FILES_FOLDER);
            return true;
        }
        if (!(0, fs_1.existsSync)(path_1.default.join(FILES_FOLDER, NEWS_FILE)))
            return true;
        if (!(0, fs_1.existsSync)(path_1.default.join(FILES_FOLDER, ADDONS_FILE)))
            return true;
        return false;
    }
    getSubfolder(addon) {
        return path_1.default.join(this.installationFolder, addon.type == Addon_1.AddonType.KART ? "karts" : "tracks", addon.id);
    }
}
exports.Database = Database;
