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

@PersistentTask.register
export class RoomAnalyst extends PersistentTask<RoomAnalystMemory, RoomAnalystArgs> {

    private room: Room
    private miningSites: MiningSite[]
    private sources: Source[]
    private safeSources: Source[]
    private constructionSites: ConstructionSite[]

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

    }

    doRun(): RunResultType {
        console.log(this, 'Running analysis ...')

        this.analyzeSources()
        this.analyzeMiningSites()
        this.analyzeConstructionSites()

        this.sleep(15)
    }

    analyzeSources() {
        const sources = this.room.find(FIND_SOURCES)
        const safeSources = sources.filter(
            source => source.pos.findInRange(FIND_HOSTILE_STRUCTURES, 5).length === 0
        )

        this.memory.sources = sources.map(source => source.id)
        this.memory.safeSources = safeSources.map(source => source.id)
    }

    analyzeMiningSites() {
        const spawn = this.room.find(FIND_MY_SPAWNS)[0];

        const newSites: MiningSite[] = [];

        this.safeSources.forEach(source => {
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

    analyzeConstructionSites() {
        this.memory.constructionSites = this.room.find(FIND_CONSTRUCTION_SITES).map(site => site.id)
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

    getMiningSites() {
        return this.miningSites
    }

    getConstructionSites() {
        return this.constructionSites
    }

    getSafeSources() {
        return this.safeSources
    }

    toString() {
        return `[RoomAnalyst ${this.room.name}]`
    }
}
