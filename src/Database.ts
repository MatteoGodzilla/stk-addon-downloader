import { Addon, AddonType } from "./Addon";
import fsync from "fs";
import fs from "fs/promises";
import path from "path";
import xml2js from "xml2js";
import os from "os";
import extractZip from "extract-zip";

const ONLINE_URL = "https://online.supertuxkart.net/dl/xml/";
const FILES_FOLDER = "files/";
const NEWS_FILE = "online_news.xml";
const ADDONS_FILE = "addons.xml";

export class Database {
    karts: Addon[] = [];
    tracks: Addon[] = [];
    arenas: Addon[] = [];
    installed: Addon[] = [];
    private raw: any;
    private initialized = false;
    private queue: Addon[] = [];
    private installationFolder = "";

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

    AddToQueue(addon: Addon) {
        this.queue.push(addon);
    }

    async ProcessQueue() {
        for (const addon of this.queue) {
            console.log(`* Downloading zip for ${addon.id}`);
            const fileName = path.basename(addon.file);
            const zipPath = path.join(FILES_FOLDER, fileName);

            await fetch(addon.file)
                .then(res => res.arrayBuffer())
                .then((arrayBuffer) => {
                    const buffer = Buffer.from(arrayBuffer);
                    return fs.writeFile(zipPath, buffer);
                })
                .then(() => {
                    const destFolder = this.getSubfolder(addon);
                    console.log(`** Extracting to ${destFolder}`);
                    return extractZip(zipPath, { dir: destFolder, });
                })
                .catch(err => console.error(`There was an error downloading ${addon.id}: ${err}`))
                .then(() => {
                    fsync.rmSync(zipPath);
                });
        }
    }

    async uninstall(toRemove: Addon) {
        const index = this.installed.findIndex(addon => addon == toRemove);
        if (index >= 0) {
            //actual valid addon
            this.installed.splice(index, 1);
            const folderPath = this.getSubfolder(toRemove);
            fsync.rmSync(folderPath, { recursive: true });
            console.log(`Successfully removed addon ${toRemove.id}`);
        }
    }

    AddonToString(addon: Addon) {
        const typeString = addon.type == AddonType.KART ? "Kart " : addon.type == AddonType.TRACK ? "Track" : "Arena";
        const installed = this.installed.includes(addon);
        return `${typeString}: ${installed ? "*" : " "} [${addon.id}] ${addon.name} by ${addon.designer} (Uploaded by ${addon.uploader})
    ${addon.description}`;
    }

    //PRIVATE METHODS

    private async downloadNewsFile() {
        const response = await fetch(path.join(ONLINE_URL, NEWS_FILE));
        const text = await response.text();
        await fs.writeFile(path.join(FILES_FOLDER, NEWS_FILE), text)
        console.log("Written online_news.xml");
    }

    private async downloadAddonsFile() {
        const newsXml = (await fs.readFile(path.join(FILES_FOLDER, NEWS_FILE))).toString();
        const news = await xml2js.parseStringPromise(newsXml);
        const url = news["news"]["include"][0]["$"]["file"];
        const response = await fetch(url);
        const text = await response.text();
        await fs.writeFile(path.join(FILES_FOLDER, ADDONS_FILE), text);
        console.log("Written addons.xml");
    }

    private async parseAddons() {
        console.log("Loaded Addons from " + ADDONS_FILE);
        const xmlText = (await fs.readFile(path.join(FILES_FOLDER, ADDONS_FILE))).toString();
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
        switch (os.platform()) {
            case "win32":
                this.installationFolder = path.join(<string>process.env.APPDATA, "supertuxkart/addons");
                break;
            case "linux":
                this.installationFolder = path.join(os.homedir(), "/.local/share/supertuxkart/addons/");
                break;
        }

        //we know the folders below contain only subfolders
        const kartSubfolder = path.join(this.installationFolder, "karts");
        const trackSubfolder = path.join(this.installationFolder, "tracks");

        if (!fsync.existsSync(kartSubfolder)) await fs.mkdir(kartSubfolder);
        if (!fsync.existsSync(trackSubfolder)) await fs.mkdir(trackSubfolder);

        this.installed = [];

        await fs.readdir(kartSubfolder)
            .then(folders => {
                for (const folder of folders) {
                    if (fsync.existsSync(path.join(kartSubfolder, folder, "kart.xml"))) {
                        const addon = this.karts.find(kart => kart.id == folder);
                        if (addon) this.installed.push(addon);
                    }
                }
            });

        await fs.readdir(trackSubfolder)
            .then(folders => {
                for (const folder of folders) {
                    if (fsync.existsSync(path.join(trackSubfolder, folder, "track.xml"))) {
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
    private checkRequiredFiles() {
        if (!fsync.existsSync(FILES_FOLDER)) {
            fsync.mkdirSync(FILES_FOLDER);
            return true;
        }
        if (!fsync.existsSync(path.join(FILES_FOLDER, NEWS_FILE)))
            return true;
        if (!fsync.existsSync(path.join(FILES_FOLDER, ADDONS_FILE)))
            return true;
        return false;
    }

    private getSubfolder(addon: Addon) {
        return path.join(this.installationFolder, addon.type == AddonType.KART ? "karts" : "tracks", addon.id);
    }

}
