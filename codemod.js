const fs = require('fs');

const FILE_PATH = './index.js';

let content = fs.readFileSync(FILE_PATH, 'utf8');

const adapterCode = `
class EmbedBuilder {
    constructor() {
        this.title = null;
        this.description = null;
        this.color = null;
        this.thumbnail = null;
        this.fields = [];
        this.footer = null;
        this.timestamp = false;
    }
    setTitle(text) { this.title = text; return this; }
    setDescription(text) { this.description = text; return this; }
    setColor(color) { this.color = color; return this; }
    setThumbnail(url) { this.thumbnail = url; return this; }
    addFields(...fields) { 
        if(Array.isArray(fields[0])) fields = fields[0];
        for (let f of fields) {
           this.fields.push(f);
        }
        return this; 
    }
    setFooter(data) { this.footer = data; return this; }
    setTimestamp() { this.timestamp = true; return this; }
    
    toComponents(extraActionRows = []) {
        const container = new ContainerBuilder();
        if (this.title) {
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent("## " + String(this.title)));
        }
        if (this.description) {
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(String(this.description)));
        }
        if (this.fields.length > 0) {
            for (let f of this.fields) {
                container.addTextDisplayComponents(new TextDisplayBuilder().setContent("**" + String(f.name) + "**\\n" + String(f.value)));
            }
        }
        if (this.footer && this.footer.text) {
             container.addSeparatorComponents(new SeparatorBuilder().setSpacing(1).setDivider(true));
             container.addTextDisplayComponents(new TextDisplayBuilder().setContent("*" + String(this.footer.text) + "*"));
        }
        if (extraActionRows && extraActionRows.length > 0) {
             container.addSeparatorComponents(new SeparatorBuilder().setSpacing(1).setDivider(true));
             for (let row of extraActionRows) {
                 container.addActionRowComponents(row);
             }
        }
        return [container];
    }
}
`;

// 1. Regex replace the require('discord.js') import to add our needed classes
// and also remove EmbedBuilder so it doesn't conflict with our adapter class.
content = content.replace(
    /(const\s+\{)(.*?)(EmbedBuilder,?\s*)(.*?)(\}\s*=\s*require\(['"]discord\.js['"]\);)/s,
    (match, p1, p2, p3, p4, p5) => {
        return p1 + p2 + p4 + ", ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags " + p5 + "\\n" + adapterCode;
    }
);

// 3. Replace all embeds: [xyz] logic
content = content.replace(/\{\s*embeds:\s*\[\s*([a-zA-Z0-9_]+)\s*\](.*?)\}/g, (match, p1, p2) => {
    let isEphemeral = p2.includes('ephemeral: true');
    let hasComponents = p2.match(/components:\s*\[(.*?)\]/);
    
    let extraRows = hasComponents ? "[" + hasComponents[1] + "]" : "[]";
    let base = "components: " + p1 + ".toComponents(" + extraRows + "), flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2";
    
    if (isEphemeral) {
        base += ", ephemeral: true";
    }
    return "{ " + base + " }";
});

fs.writeFileSync(FILE_PATH, content, 'utf8');

console.log('Codemod applied aggressively using regex!');
