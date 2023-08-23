#!/usr/bin/env node
import { program } from "commander";
import { Database } from "./Database";
import { Addon, AddonStatus } from "./Addon";
import { writeFileSync, readFileSync, rmdirSync } from "fs";

const db = new Database();

async function search(name: string) {
    const options = program.opts();
    await db.Init(options.r);
    if (!options.k && !options.t && !options.a)
        options.e = true;

    let searching: Addon[] = [];
    if (options.k || options.e)
        searching = searching.concat(db.karts);
    if (options.t || options.e)
        searching = searching.concat(db.tracks);
    if (options.a || options.e)
        searching = searching.concat(db.arenas);

    if (options.f)
        searching = searching.filter(addon => addon.status.includes(AddonStatus.FEATURED));

    const result: string[] = [];

    for (const addon of searching) {
        if (addon.id.includes(name) || addon.name.includes(name) || addon.uploader.includes(name) ||
            addon.designer.includes(name) || addon.description.includes(name)) {
            console.log(db.AddonToString(addon));
            result.push(addon.id);
        }
    }

    if (options.i) {
        installAddons(result);
    }
}

async function info(id: string) {
    const options = program.opts();
    await db.Init(options.r);
    if (!options.k && !options.t && !options.a)
        options.e = true;

    let searching: Addon[] = [];

    if (options.k || options.e)
        searching = searching.concat(db.karts);
    if (options.t || options.e)
        searching = searching.concat(db.tracks);
    if (options.a || options.e)
        searching = searching.concat(db.arenas);

    for (const addon of searching) {
        if (addon.id == id) {
            console.log(addon);
        }
    }
}

async function list() {
    const options = program.opts();
    await db.Init(options.r);
    for (const addon of db.installed) {
        console.log(db.AddonToString(addon));
    }
}

async function installAddons(ids: string[]) {
    const options = program.opts();
    await db.Init(options.r);
    if (!options.k && !options.t && !options.a)
        options.e = true;

    //check if it already installed
    //const installedIds = db.installedKartIds.concat(db.installedTrackIds);
    for (const query of ids) {
        if (db.installed.some(addon => addon.id == query)) {
            console.log(`Addon with id ${query} is already installed. Skipping`);
            continue;
        }

        let addon = undefined;
        if (addon == undefined && (options.k || options.e))
            addon = db.karts.find(kart => kart.id == query);
        if (addon == undefined && (options.t || options.e))
            addon = db.tracks.find(track => track.id == query);
        if (addon == undefined && (options.a || options.e))
            addon = db.arenas.find(track => track.id == query);

        if (addon != undefined) {
            db.AddToQueue(addon);
        } else {
            console.error(`Addon with id ${query} not found`);
        }
    }
    await db.ProcessQueue();
    console.log("Installation complete");
}

async function uninstallAddons(ids: string[]) {
    const options = program.opts();
    await db.Init(options.r);

    for (const id of ids) {
        const addon = db.installed.find(addon => addon.id == id);
        if (addon) {
            //delete folder
        }
    }

}

async function exportInstalled(path: string) {
    const options = program.opts();
    await db.Init(options.r);
    let output = "";

    for (const addon of db.installed) {
        output += addon.id + "\n";
    }
    writeFileSync(path, output);
    console.log("Finished exporting into " + path);
}

async function importInstalled(path: string) {
    const options = program.opts();
    await db.Init(options.r);

    const text = (readFileSync(path)).toString();
    const ids = text.replace("\r", "").split('\n');
    installAddons(ids);
}

//PROGRAM SETUP

program.usage("[command] [options]");

program
    .command("refresh")
    .description("Refreshes the addon database")
    .action(async () => {
        await db.Init(true);
    });

program
    .command("search <name>")
    .description("Searches for karts, tracks and arenas for <name>")
    .action((name) => { search(name); });

program
    .command("info <id>")
    .description("Prints informations about the addon with <id>")
    .action(info);

program
    .command("list")
    .description("List installed addons")
    .action(list);

program
    .command("install <id...>")
    .description("Install the addons list specified after the command ")
    .action(installAddons);

program
    .command("uninstall <id...>")
    .description("Uninstall the addons list specified after the command ")
    .action(uninstallAddons);

program
    .command("export <filename>")
    .description("Export the installed addons into <filename>")
    .action(exportInstalled);

program
    .command("import <filename>")
    .description("Installs additional addons from <filename>")
    .action(importInstalled);

program
    .option("-k", "Adds karts into searching list ", false)
    .option("-t", "Adds tracks into searching list", false)
    .option("-a", "Adds arenas into searching list", false)
    .option("-e", "Adds everything into searching list", false)
    .option("-f", "Set filter to Featured", false)
    .option("-r", "Refreshes files before command (like running the refresh command)", false)
    .option("-i", "Searches packages and then installs everything in the list");


program.parse();