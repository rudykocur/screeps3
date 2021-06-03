import { notEmpty } from "./common"

class RoomNameSelector {
    constructor() {}

    selectGroup(usedNames: string[]) {
        const groups = names
            .map(group => group.group)
            .filter(notEmpty)
            .filter(value => usedNames.indexOf(value) < 0)

        return this.selectRandom(groups)
    }

    getGroup(name: string) {
        return names.find(group => group.group === name)
    }

    selectActorName(groupName: string) {
        return this.selectRandom(this.getGroup(groupName)?.names || [])
    }

    selectMainLocation(groupName: string) {
        const group = this.getGroup(groupName)

        if(!group) {
            return null
        }

        return group.mainLocation || this.selectLocation(groupName, [])
    }

    selectLocation(groupName: string, usedLocations: string[]) {
        const group = this.getGroup(groupName)

        if(!group) {
            return null
        }

        const locations = group.locations.filter(value => usedLocations.indexOf(value) < 0)

        return this.selectRandom(locations)
    }

    private selectRandom(array: string[]): string {
        const index = Math.floor(Math.random() * array.length)

        return array[index]
    }
}

export const nameSelector = new RoomNameSelector()

const names = [
    {
        group: 'starwars',
        mainLocation: null,
        locations: ["Tatooine", "Coruscant", "Alderaan", "Hoth", "Jakku", "Correlia", "Yavin"],
        names: ["Luke", "Leia", "Darth Vader", "Anakin", "Palpatine", "Han", "Poe", "Finn", "Rose",
            "Obi-Wan", "Qui-Gon", "Darth Maul", "Padme", "Shmi", "Yoda", "Mace Windu", "Plo Koon"]
    },
    {
        group: 'lotr',
        mainLocation: null,
        locations: ["Moria", "Gondor", "Mordor", "Rohan", "Minias Tirith", "Minias Morgul", "Rivendell"],
        names: ["Arwena", "Gimli", "Legolas", "Frodo", "Gandalf", "Aragorn", "Sauron", "Bilbo", "Gollum",
            "Galadriela", "Balrog", "Eowina", "Elrond", "Samwise", "Saruman", "Bormir", "Faramir", "Peregin",
            "Meriador", "Theoden", "Szeloba", "Radagast", "Glorfindel", "Grima", "Isildur", "Treebeard",
            "Gamling", "Beregond", "Forlong"],
    },
    {
        group: 'fallout',
        mainLocation: null,
        locations: ["Arroyo", "The Den", "New Vegas", "Junktown", "Cathedral", "The Glow",
            "Shady Sands", "Khans", "Klamath", "Navarro", "Gecko", "Redding"],
        names: ["Dogmeat", "Cindy", "Tycho", "Ian", "Aradesh", "Razlo", "Tandi", "Gizmo", "Harold",
            "Ringo", "ED-E", "Marcus", "Goris", "Sulik", "Vic", "Mynoc", "John Sullivan", "Metziger",
            "Randal", "Valerie", "Wooz", "Chad", "Elmo", "Josh Laurence", "T-Ray", "Renesco", "Myron",
            "Ariel", "Theresa"],
    },
    {
        group: 'firefly',
        mainLocation: "Serenity",
        locations: ["Ariel", "Beaumonde", "Persephone", "Poseidon", "Haven", "Canton"],
        names: ["Badger", "Katie", "Inara", "Jayne", "Higgins", "Simon", "River",
            "Malcolm", "Zoe", "Hoban", "Shepperd Books", "Saffron", "Rance Burgess", "Warwick Harrow",
            "Stitch Hesian", "Fess Higgins", "Adelei Nishka", "Atherton Wing"],
    },
    {
        group: 'bebop',
        mainLocation: "Bebop",
        locations: ["La Fin", "Red Dragon HQ", "Tijuana", "Ganymeyde", "Alba City", "Cafe Ifrane", "Wcdonald"],
        names: ["Spike", "Faye", "Edward", "Ein", "Vicious", "Laughing Bull", "Julia", "VT",
            "Punch", "Judy", "Antonio", "Carlos", "Jobim", "Lin", "Shin", "Annie", "Tongpu",
            "Mao", "Rashid", "Grencia"],
    },
    // {
    //     group: 'dragonBall',
    //     mainLocation: null,
    //     locations: [],
    //     names: [],
    // },
    {
        group: 'witcher',
        mainLocation: "Kaer Morhen",
        locations: ["Wyzima", "Cintra", "Vengerberg", "Mahakam", "Kaedwen", "Kovir", "Redania",
            "Temeria", "Aedirn", "Nilfgaard", "Skellige", "Novigrad"],
        names: [
            "Borch",
            "Cahir","Ciri","Calanthe",
            "Detmold","Dijskra","Dorregay","Demawend","Duny",
            "Emhyr","Eskel","Essi","Eistem Tuirseach",
            "Foltest","Francesca Findabar","Fringilla Vigo","Filippa Eilhart",
            "Geralt",
            "Henselt",
            "Idarran","Istredd",
            "Jan Natalis","Jaskier",
            "Keria Metz","Kozojed","Koral",
            "Lambert","Leo Bonhart",
            "Milva","Mistle",
            "Nenneke",
            "Ortolan",
            "Płotka","Pavetta",
            "Radcliffe","Regis","Rience",
            "Sabrina Glevissig","Shani","Sheldon Skaags","Skomlik",
            "Tissaia de Vires","Torque","Toruviel","Triss",
            "Vesemir","Vilgefortz","Visenna","Vysogota z Corvo",
            "Yen", "Yarpen Zigrin",
            "Zoltan","Zuleyka","Zyvik"
        ],
    },
    // {
    //     group: 'drWho',
    //     mainLocation: null,
    //     locations: [],
    //     names: [],
    // },
    {
        group: 'hungerGames',
        mainLocation: "Capitol",
        locations: ["Masonry", "Forestry", "Textiles", "Mining", "Fishing", "Livestock", "Fruits"],
        names: ["Katniss", "Peeta", "Prim", "Gale", "Primrose", "Haymitch", "Cinna", "Snow",
            "Cato", "Effie Trinket", "Clove", "Seneca", "Glimmer", "Caesar Flickerman",
            "Rue", "Tresh", "Flavius", "Octavia", "Foxface", "Cashmere"],
    },
    {
        group: 'lovecraft',
        mainLocation: null,
        locations: ["Tsath", "Altuas", "Thule", "Irem", "Koth", "R'lyeh", "Arkham", "Miskatonic",
            "Dunwich", "Kingsport", "Innsmouth"],
        names: ["Cthulu", "Azathoth", "Nyarlathothep", "Yog-sothoth", "Shub-Niggurath", "Hastur",
            "Dagon", "Tsathoggua", "Kthanid", "Mother Hydra", "Abhoth", "Adaedu", "Yogash",
            "Kuranes", "Zkauba", "Alala", "Kaalut", "Algol", "Yorith", "Ubb", "Nira", "Nycrama", "Othuum"],
    },
    {
        group: 'dune',
        mainLocation: "Arrakis",
        locations: ["Selamik", "Ceres", "Corrin", "Draconis"],
        names: ["Paul Atryda", "Irulan", "Liet-Kynes", "Weliington Yueh", "Vladimir Harkonnen",
            "Duncan Idaho", "Gaius Mohiam", "Lady Jessika", "Leo Atryda", "Chani", "Feyd Rautha",
            "Hasimir Fering", "Hellen Mohiam", "Bellmonda", "Harishka", "Wensicia", "Miles Teg",
            "Stiglar", "Shaddam IV", "Murbella", "Lucilla", "Gurney Halleck", "Norma Cenva",
            "Serena Buter", "Farok", "Geoff"],
    },
    {
        group: 'baldursGate',
        mainLocation: "Baldur’s Gate",
        locations: ["Cloakwood", "Red Canyons", "Beregost", "Ulcaster", "Nashkel", "Larswood",
            "Peldvale", "Undercity", "Candlekeep"],
        names: ["Imoen", "Minsc", "Boo", "Jaheira", "Edwin", "Viconia", "Khalid", "Dynaheir",
            "Xzar", "Montaron", "Xan", "Branwen", "Kivan", "Coran", "Safana", "Tiax", "Shar-Teel",
            "Skie", "Quayle", "Yeslick", "Ajantis", "Garrick", "Alora", "Biff", "Sarevok",
            "Irenicus", "Caelar", "Korgan", "Mazzy", "Valygar", "Keldorn", "Cernid", "Anomen Delryn", "Aerie"],
    },
    {
        group: 'sandman',
        mainLocation: null,
        locations: ["Asylum", "Dreaming", "Limbo", "Silver City", "The Dying", "Delirium's Realm", "Necropolis"],
        names: ["Destiny", "Death", "Dream", "Destruction", "Desire", "Despair", "Delirium", "Cain",
            "Abel", "Eve", "Goldie", "Lucien", "Mervyn", "Cuckoo", "Odin", "Ishtar", "Azazel",
            "Beelzebub", "Chorozon", "Lucifer", "Mazikeen", "Remiel", "Alex Burgess", "Johanna Constantine",
            "Doctor Dee", "Wesley Dodds", "Barnabas"],
    },
    {
        group: 'poe',
        mainLocation: null,
        locations: ["Highgate", "Sarn", "Lioneye", "The Coast", "Axiom Prison", "Oriath",
            "Solaris Temple", "Forest Encampment"],
        names: ["Atziri", "Doryiani", "Sin", "Innocence", "Cathrina", "Siosa", "Veruso",
            "Maligaro", "Doedre", "Malachai", "Victario", "King Kaom", "Shavronne", "Brutus",
            "Voll", "Dominus", "Avarius", "Piety", "Gravicus", "Solaris", "Lunaris", "Arakaali",
            "Garukhan", "Yugul", "Tukohama", "Gruthkul", "Ralakesh", "Rysathla", "Shakari"],
    },
    // {
    //     group: 'talisman',
    //     mainLocation: null,
    //     locations: [],
    //     names: [],
    // },
    {
        group: 'marvel',
        mainLocation: null,
        locations: ["Asgard", "Xavier Institute", "Castle Doom", "Baxter", "Atlantis", "Latveira", "Genosha"],
        names: ["Thanatos", "Iron Man", "Thor", "Loki", "Captain America", "Hulk", "Hawkeye",
            "Black Widow", "Doctor Strange", "Ant-man", "Vision", "Ultron", "Nick Fury", "Groot",
            "Gamora", "Rocket Racoon", "Drax", "Wasp", "Falcon", "Venom"],
    },
    // {
    //     group: 'fringe',
    //     mainLocation: null,
    //     locations: [],
    //     names: [],
    // },
    // {
    //     group: 'sherlock',
    //     mainLocation: null,
    //     locations: [],
    //     names: [],
    // },
    {
        group: 'pokemon',
        mainLocation: null,
        locations: ["Virdian", "Vermilion", "Safari Zone", "Pewter", "Mt. Moon", "Cinnabar Island",
            "Cerulean", "Celadon", "Violet City", "Rustboro"],
        names: ["Bulbasaur", "Charmander", "Squirtle", "Pikachu", "Geodude", "Diglet", "Growlite",
            "Ninetales", "Abra", "Kadabra", "Alakazam", "Ekans", "Arbok", "Rhydon", "Sandshrew",
            "Ratata", "Pidgey", "Chansey", "Magikarp", "Gyarados", "Onyx", "Magmar", "Slugma",
            "Vulpix", "Staryu", "Porygon", "Kabuto", "Farfetch", "Tauros", "Lapras", "Electrabuzz",
            "Nuzleaf", "Sedoot", "Pineco", "Arctuino", "Mew", "Zapdos", "Eeve", "Umbreon",
            "Vaporeon", "Flareon", "Jolteon", "Scyther"],
    },
    // {
    //     group: '',
    //     mainLocation: null,
    //     locations: [],
    //     names: [],
    // },
]
