#!/usr/bin/env node
import { program, Option } from "commander";
import { Database } from "./Database";
import { Addon, AddonStatus } from "./Addon";
import { writeFileSync, readFileSync } from "fs";

const db = new Database();

async function search() {
    const options = program.opts();
    if (!options.kart && !options.track && !options.arena)
        options.everything = true;
    await db.Init();

    let searching: Addon[] = [];
    if (options.kart || options.everything)
        searching = searching.concat(db.karts);
    if (options.track || options.everything)
        searching = searching.concat(db.tracks);
    if (options.arena || options.everything)
        searching = searching.concat(db.arenas);

    if (options.featured)
        searching = searching.filter(addon => addon.status.includes(AddonStatus.FEATURED));

    if (options.name) {
        searching = searching.filter(addon => {
            return addon.id.includes(options.name) || addon.name.includes(options.name) ||
                addon.uploader.includes(options.name) || addon.designer.includes(options.name) ||
                addon.description.includes(options.name);
        });
    }

    const result: string[] = [];

    if (options.i) {
        let str = "Ids found: ";
        for(const addon of searching){
            str += addon.id + " ";
            result.push(addon.id);
        }
        console.log(str);
        installAddons(result);
    } else {
        for (const addon of searching) {
            console.log(db.AddonToString(addon));
            result.push(addon.id);
        }
    }

}

async function info(id: string) {
    const options = program.opts();
    if (!options.kart && !options.track && !options.arena)
        options.everything = true;

    await db.Init();

    let searching: Addon[] = [];
    if (options.kart || options.everything)
        searching = searching.concat(db.karts);
    if (options.track || options.everything)
        searching = searching.concat(db.tracks);
    if (options.arena || options.everything)
        searching = searching.concat(db.arenas);

    for (const addon of searching) {
        if (addon.id == id) {
            console.log(addon);
        }
    }
}

async function list() {
    await db.Init();
    for (const addon of db.installed) {
        console.log(db.AddonToString(addon));
    }
}

async function installAddons(ids: string[]) {
    const options = program.opts();
    await db.Init();
    if (!options.kart && !options.track && !options.arena)
        options.everything = true;

    for (const query of ids) {
        if (db.installed.some(addon => addon.id == query)) {
            console.log(`Addon with id ${query} is already installed. Skipping`);
            continue;
        }

        let addon = undefined;
        if (addon == undefined && (options.kart || options.everything))
            addon = db.karts.find(kart => kart.id == query);
        if (addon == undefined && (options.track || options.everything))
            addon = db.tracks.find(track => track.id == query);
        if (addon == undefined && (options.arena || options.everything))
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
    await db.Init();

    for (const id of ids) {
        const addon = db.installed.find(addon => addon.id == id);
        if (addon) {
            db.uninstall(addon);
        }
    }
}

async function exportInstalled(path: string) {
    await db.Init();
    let output = "";

    for (const addon of db.installed) {
        output += addon.id + "\n";
    }
    writeFileSync(path, output);
    console.log("Finished exporting into " + path);
}

async function importInstalled(path: string) {
    await db.Init();

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
        await db.Init();
    });

program
    .command("search [options] ")
    .description("Searches for karts, tracks and arenas for <name>")
    .action(search);

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
    .option("-k|--kart", "Consider karts into searching list ")
    .option("-t|--track", "Consider tracks into searching list")
    .option("-a|--arena", "Consider arenas into searching list")
    .addOption(new Option("-e|--everything", "Consider everything into searching list")
        .implies({
            kart: true,
            track: true,
            arena: true
        }))
    .option("-f|--featured", "Set filter to Featured")
    .option("-n|--name <name>", "Set filter to specified name")
    .option("-i", "Searches packages and then installs everything in the list ")
    .addHelpText("after", "\nIf the flags -k, -t, -a or -e are not specified, everything will be selected by default");


program.parse();