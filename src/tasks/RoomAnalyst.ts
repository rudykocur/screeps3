import { RunResultType } from "./AbstractTask";
import { RoomManager } from "./RoomManager";
import { PersistentTask } from "./PersistentTask";
import { getPositionsAround } from "../utils/MapUtils"
import { packPos, unpackPos } from "../utils/packrat"
import { notEmpty } from "utils/common";

interface RoomAnalystMemory {
    roomName: string,
    miningSites?: MiningSiteMemory[]
    sources?: Id<Source>[]
    safeSources?: Id<Source>[]
    constructionSites?: Id<ConstructionSite>[]
    extensions?: Id<StructureExtension>[]
    storage?: {
        location: string
        containerId?: Id<StructureContainer>
        id?: Id<StructureStorage>
    }
}

interface MiningSiteMemory {
    sourceId: Id<Source>
    containerId?: Id<StructureContainer>
    containerPos: string
}

interface RoomAnalystArgs {
    room: RoomManager
}

interface MiningSite {
    source: Source
    container?: StructureContainer | null
    containerPos: RoomPosition
}

export class RoomStorageWrapper {

    constructor(
        public location: RoomPosition,
        public container?: StructureContainer | null,
        public storage?: StructureStorage | null
    ) {}

    getResourceAmount(resource: ResourceConstant): number {
        if(this.container) {
            return this.container.store[resource]
        }
        if(this.storage) {
            return this.storage.store[resource]
        }

        return 0
    }
}

@PersistentTask.register
export class RoomAnalyst extends PersistentTask<RoomAnalystMemory, RoomAnalystArgs> {

    private room: Room
    private miningSites: MiningSite[]
    private sources: Source[]
    private safeSources: Source[]
    private constructionSites: ConstructionSite[]
    private extensions: StructureExtension[]

    private storage?: RoomStorageWrapper | null

    initMemory(args: RoomAnalystArgs): RoomAnalystMemory {
        return {
            roomName: args.room.name,
        }
    }

    doInit(): void {
        this.room = Game.rooms[this.memory.roomName]

        this.miningSites = []
        for(const site of (this.memory.miningSites || [])) {
            const source = Game.getObjectById(site.sourceId);

            if(!source) {
                continue
            }

            this.miningSites.push({
                source: source,
                container: site.containerId ? Game.getObjectById(site.containerId) : null,
                containerPos: unpackPos(site.containerPos)
            })
        }

        this.safeSources = this.memory.safeSources
            ?.map(source => Game.getObjectById(source))
            ?.filter(notEmpty) || []

        this.constructionSites = this.memory.constructionSites
            ?.map(siteId => Game.getObjectById(siteId))
            ?.filter(notEmpty) || []

        this.extensions = this.memory.extensions
            ?.map(extensionId => Game.getObjectById(extensionId))
            ?.filter(notEmpty) || []

        if(this.memory.storage) {
            this.storage = new RoomStorageWrapper(
                unpackPos(this.memory.storage.location),
                this.memory.storage.containerId ? Game.getObjectById(this.memory.storage.containerId) : null,
                this.memory.storage.id ? Game.getObjectById(this.memory.storage.id) : null
            )
        }
    }

    doRun(): RunResultType {
        console.log(this, 'Running analysis ...')

        this.analyzeStorage()
        this.analyzeSources()
        this.analyzeMiningSites()
        this.analyzeConstructionSites()
        this.analyzeExtensions()

        this.sleep(15)
    }

    private analyzeStorage() {
        if(this.room.storage) {
            this.memory.storage = {
                location: packPos(this.room.storage.pos),
                id: this.room.storage.id,
            }
        }
        else {
            const storageFlag = Object.values(Game.flags).find(flag =>
                flag.pos.roomName === this.room.name && flag.color === COLOR_YELLOW && flag.secondaryColor == COLOR_YELLOW
            )

            if(storageFlag) {
                const containers = storageFlag.pos.findInRange<StructureContainer>(FIND_STRUCTURES, 1, {
                    filter: struct => struct.structureType === STRUCTURE_CONTAINER
                })
                this.memory.storage = {
                    location: packPos(storageFlag?.pos)
                }
                if(containers.length > 0) {
                    this.memory.storage.containerId = containers[0].id
                }
            }
        }
    }

    private analyzeSources() {
        const sources = this.room.find(FIND_SOURCES)
        const safeSources = sources.filter(
            source => source.pos.findInRange(FIND_HOSTILE_STRUCTURES, 5).length === 0
        )

        this.memory.sources = sources.map(source => source.id)
        this.memory.safeSources = safeSources.map(source => source.id)
    }

    private analyzeMiningSites() {
        const spawn = this.room.find(FIND_MY_SPAWNS)[0];

        const newSites: MiningSite[] = [];

        this.safeSources.forEach(source => {
            const existingContainers = source.pos.findInRange<StructureContainer>(FIND_STRUCTURES, 1, {
                filter: obj => obj.structureType == STRUCTURE_CONTAINER
            })

            if(existingContainers.length > 0) {
                const existingContainer = existingContainers[0]

                newSites.push({
                    source: source,
                    containerPos: existingContainer.pos,
                    container: existingContainer
                })

                return
            }

            const containerBuildSites = source.pos.findInRange(FIND_CONSTRUCTION_SITES, 1, {
                filter: site => site.structureType === STRUCTURE_CONTAINER
            })

            if(containerBuildSites.length > 0) {
                const containerBuildSite = containerBuildSites[0]

                newSites.push({
                    source: source,
                    containerPos: containerBuildSite.pos,
                })

                return
            }

            const validPositions = getPositionsAround(source.pos).filter(pos => {
                const elements = pos.look()

                for(const item of elements) {
                    if(item.terrain === "wall") {
                        return false
                    }
                    if(item.constructionSite && item.constructionSite.structureType !== STRUCTURE_CONTAINER) {
                        return false
                    }
                }

                return true
            }).map(pos => {
                return {
                    pos: pos,
                    distance: pos.findPathTo(spawn.pos).length
                }
            }).sort((a, b) => {
                return a.distance - b.distance
            });

            if(validPositions.length > 0) {
                const siteContainerPos = validPositions[0].pos;
                const containers = source.pos.findInRange<StructureContainer>(FIND_MY_STRUCTURES, 1, {
                    filter: obj => obj.structureType == STRUCTURE_CONTAINER
                })

                newSites.push({
                    source: source,
                    containerPos: siteContainerPos,
                    container: containers[0]
                })
            }
        })

        this.miningSites = newSites
        this.memory.miningSites = newSites.map(site => {
            return {
                sourceId: site.source.id,
                containerPos: packPos(site.containerPos),
                containerId: site.container?.id
            }
        })
    }

    private analyzeConstructionSites() {
        this.memory.constructionSites = this.room.find(FIND_CONSTRUCTION_SITES).map(site => site.id)
    }

    private analyzeExtensions() {
        if(!this.room.controller) {
            return
        }

        const spawn = this.room.find<StructureSpawn>(FIND_MY_STRUCTURES, {
            filter: struct => struct.structureType === STRUCTURE_SPAWN
        })[0]

        const extensions = this.room.find<StructureExtension>(FIND_MY_STRUCTURES, {
            filter: struct => struct.structureType === STRUCTURE_EXTENSION
        });
        this.memory.extensions = extensions.map(ext => ext.id)

        const exisingExtensionsAmount = extensions.length

        const extensionsInConstruction = this.room.find(FIND_CONSTRUCTION_SITES, {
            filter: site => site.structureType === STRUCTURE_EXTENSION
        }).length

        const maxExtensions = CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][this.room.controller.level]

        if(exisingExtensionsAmount + extensionsInConstruction >= maxExtensions) {
            return
        }

        let buildSize = Math.ceil(Math.sqrt((maxExtensions)*2))
        if(buildSize % 2 === 0) {
            buildSize += 1
        }

        this.room.visual.rect(spawn.pos.x - buildSize/2, spawn.pos.y - buildSize/2, buildSize, buildSize)

        let placedExtensions = 0

        const baseLeft = spawn.pos.x - (buildSize-1)/2
        const baseTop = spawn.pos.y - (buildSize-1)/2

        this.room.visual.circle(baseLeft, baseTop)

        for(let i = 0; i < buildSize; i++) {
            for(let j = 0; j < buildSize; j++) {
                const pos = new RoomPosition(baseLeft + j, baseTop + i, spawn.pos.roomName)

                if(!(i%2==1 && j%2==1) && !(i%2==0 && j%2==0)) {
                    continue
                }

                if(!this.isBuildable(pos)) {
                    continue
                }

                this.room.visual.circle(pos, {
                    fill: 'green'
                })

                pos.createConstructionSite(STRUCTURE_EXTENSION)

                placedExtensions++

                if(placedExtensions >= maxExtensions) {
                    break
                }
            }

            if(placedExtensions >= maxExtensions) {
                break
            }
        }
    }

    isBuildable(pos: RoomPosition): boolean {
        const elements = pos.look()

        for(const item of elements) {
            if(item.terrain === "wall") {
                return false
            }
            if(item.structure) {
                return false
            }
            if(item.constructionSite) {
                return false
            }
        }

        return true
    }

    doVisualize() {
        for(const site of this.miningSites) {
            this.room.visual.circle(site.containerPos)
        }

        for(const source of this.safeSources) {
            this.room.visual.circle(source.pos, {
                fill: "green"
            })
        }
    }

    getRCL() {
        return this.room.controller?.level || 0
    }

    getStorage() {
        return this.storage
    }

    getMiningSites() {
        return this.miningSites
    }

    getConstructionSites() {
        return this.constructionSites
    }

    getSafeSources() {
        return this.safeSources
    }

    getExtensions() {
        return this.extensions
    }

    toString() {
        return `[RoomAnalyst ${this.room.name}]`
    }
}
