import { Addon, AddonType } from "./Addon";
import { createWriteStream, existsSync, mkdirSync, readdirSync, writeFileSync, readFileSync } from "fs";
import path from "path";
import xml2js from "xml2js";
import os from "os";
import { get } from "https";
import { IncomingMessage } from "http";
import extractZip from "extract-zip";

const ONLINE_URL = "https://online.supertuxkart.net/dl/xml/";
const FILES_FOLDER = "files/";
const NEWS_FILE = "online_news.xml";
const ADDONS_FILE = "addons.xml";
//TODO: THIS WONT WORK ON WINDOWS
const INSTALL_DIR = os.homedir() + "/.local/share/supertuxkart/addons/";

export class Database {
    karts: Addon[] = [];
    tracks: Addon[] = [];
    arenas: Addon[] = [];
    installed:Addon[] = [];
    private raw: any;
    private initialized = false;
    private queue: Addon[] = [];

    async Init(forceRefresh: boolean): Promise<Database> {
        if (!this.initialized) {
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

    private webRequest(url: string): Promise<IncomingMessage> {
        return new Promise((resolve, _) => {
            get(url, (res) => {
                if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    this.webRequest(res.headers.location).then(resolve);
                } else {
                    resolve(res);
                }
            });
        });
    }

    AddToQueue(addon: Addon) {
        this.queue.push(addon);
    }

    async ProcessQueue() {
        const promises: Promise<void>[] = [];
        for (const addon of this.queue) {
            promises.push(new Promise<void>((resolve, reject) => {
                console.log(`* Installing ${addon.id}`);
                const fileName = path.basename(addon.file);
                const zipPath = path.join(FILES_FOLDER, fileName);
                const fileStream = createWriteStream(zipPath);

                this.webRequest(addon.file).then((res) => {
                    res.on("data", (chunk) => {
                        fileStream.write(chunk);
                    });
                    res.on("end", async () => {
                        fileStream.close();
                        const destFolder = path.join(INSTALL_DIR, addon.type == AddonType.KART ? "karts" : "tracks", addon.id);
                        console.log(`Extracting to ${destFolder}`);
                        extractZip(zipPath, { dir: destFolder }).then(resolve).catch(reject);
                    });
                    res.on("error", (err) => {
                        console.error(`There was an error installing ${addon.id}: ${err}`);
                        reject();
                    });
                });
                /*
                this.webRequest(addon.file).then((res) => {
                    res.on("data", (chunk) => {
                        fileStream.write(chunk);
                    });
                    res.on("end", async () => {
                        fileStream.close();
                        const destFolder = path.join(INSTALL_DIR, addon.type == AddonType.KART ? "karts" : "tracks", addon.id);
                        console.log(`Extracting to ${destFolder}`);
                        extractZip(zipPath, { dir: destFolder }).then(resolve).catch(reject);
                    });
                    res.on("error", (err) => {
                        console.error(`There was an error installing ${addon.id}: ${err}`);
                        reject();
                    });
                });
                */
            }));
        }

        return Promise.allSettled(promises);
    }

    async uninstall(id: string) {

    }

    AddonToString(addon: Addon) {
        const typeString = addon.type == AddonType.KART ? "Kart " : addon.type == AddonType.TRACK ? "Track" : "Arena";
        const installed = this.installed.includes(addon);
        return `${typeString}: ${installed ? "*" : " "} [${addon.id}] ${addon.name} by ${addon.designer} (Uploaded by ${addon.uploader})
    ${addon.description}`;
    }

    //PRIVATE METHODS

    private async downloadNewsFile() {
        const response = await fetch(ONLINE_URL + NEWS_FILE);
        const text = await response.text();
        writeFileSync(FILES_FOLDER + NEWS_FILE, text);
        console.log("Written online_news.xml");
    }

    private async downloadAddonsFile() {
        const newsXml = readFileSync(FILES_FOLDER + NEWS_FILE).toString();
        const news = await xml2js.parseStringPromise(newsXml);
        const url = news["news"]["include"][0]["$"]["file"];
        const response = await fetch(url);
        const text = await response.text();
        writeFileSync(FILES_FOLDER + ADDONS_FILE, text);
        console.log("Written addons.xml");
    }

    private async parseAddons() {
        console.log("Loaded Addons from " + ADDONS_FILE);
        const xmlText = readFileSync(FILES_FOLDER + ADDONS_FILE).toString();
        const obj = await xml2js.parseStringPromise(xmlText);
        this.raw = obj["assets"];
        for (const dollarKart of this.raw["kart"]) {
            const newKart = new Addon(AddonType.KART, dollarKart);
            //this is the most absolute dogshit way to do this
            this.karts = this.karts.filter(kart => kart.id != newKart.id || kart.revision > newKart.revision);
            this.karts.push(newKart);
        }
        for (const dollarTrack of this.raw["track"]) {
            const newTrack = new Addon(AddonType.TRACK, dollarTrack);
            //this is the most absolute dogshit way to do this
            this.tracks = this.tracks.filter(track => track.id != newTrack.id || track.revision > newTrack.revision);
            this.tracks.push(newTrack);
        }
        for (const dollarArena of this.raw["arena"]) {
            const newArena = new Addon(AddonType.ARENA, dollarArena);
            //this is the most absolute dogshit way to do this
            this.arenas = this.arenas.filter(arena => arena.id != newArena.id || arena.revision > newArena.revision);
            this.arenas.push(newArena);
        }
    }

    private async loadInstalled() {
        console.log("Loaded installed addons ");
        //we know the folders below contain only subfolders
        if (!existsSync(INSTALL_DIR + "karts"))
            mkdirSync(INSTALL_DIR + "karts");
        if (!existsSync(INSTALL_DIR + "tracks"))
            mkdirSync(INSTALL_DIR + "tracks");

        const installedKartIds = readdirSync(INSTALL_DIR + "karts");
        const installedTrackIds = readdirSync(INSTALL_DIR + "tracks");

        const kartsInstalled = this.karts.filter(kart => installedKartIds.includes(kart.id));
        const tracksInstsalled = this.tracks.filter(track => installedTrackIds.includes(track.id));
        const arenasInstalled = this.arenas.filter(arena => installedTrackIds.includes(arena.id));

        this.installed = kartsInstalled.concat(tracksInstsalled).concat(arenasInstalled);
    }


}
