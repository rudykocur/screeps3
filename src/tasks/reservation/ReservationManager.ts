import { GenericTask } from "TaskManager";
import { RunResultType } from "tasks/AbstractTask";
import { StructureWithGeneralStorage } from "types";
import { PersistentTask } from "../PersistentTask";
import { counter } from "GlobalCounter";
import { ContainerReservation } from "./ContainerReservation";
import { ResourceReservation } from "./ResourceReservation";
import { ReservationManagerMemory, ReservationManagerArgs, ReservableHandler, IReservationManager } from "./common";
import { ExtensionCluster } from "tasks/RoomAnalyst";
import { ExtensionClusterReservation } from "./ExtensionClusterReservation";
import { Logger } from "Logger";
import { ControllerReservation } from "./ControllerReservation";

type ReserveClasses =
    | StructureSpawn
    | StructureWithGeneralStorage
    | Resource
    | ExtensionCluster
    | Tombstone
    | Ruin
    | StructureExtension
    | StructureTower
    | StructureController

@PersistentTask.register
export class ReservationManager extends PersistentTask<ReservationManagerMemory, ReservationManagerArgs> implements IReservationManager {

    private reservationHandlers: ReservableHandler[] = []
    private handlersMap: Record<string, ReservableHandler> = {}

    private logger = new Logger('ReservationManager')

    initMemory(args: ReservationManagerArgs): ReservationManagerMemory {
        return {
            handlers: [],
        }
    }

    doInit() {}

    doLateInit(): void {
        const implementations = IReservationManager.getReservationHandlers()
        this.memory.handlers.forEach(handlerData => {
            const impl = implementations.find(impl => impl.name === handlerData.type)

            if(impl) {
                const handler = new impl(this)
                handler.init(handlerData.data)

                const targetId = handler.getTargetId()

                if(!targetId) {
                    if(handlerData.data.volatile !== true) {
                        this.logger.debug(this, 'WARNING! No target for', handlerData.type, '::', handlerData.targetId, '::', JSON.stringify(handlerData.data))
                    }
                    this.memory.handlers = this.memory.handlers.filter(handler => handler.targetId !== handlerData.targetId)
                    return
                }

                this.reservationHandlers.push(handler)
                this.handlersMap[targetId] = handler
            }
            else {
                this.logger.error('[ReservationManager] WARNING! No implementation for', handlerData.type)
            }
        })
    }

    doRun(): RunResultType {}

    getHandler<K extends ReserveClasses>(type: K): ReservableHandler | null {

        if(type.id in this.handlersMap) {
            return this.handlersMap[type.id]
        }

        const handler = this.createHandler(type)
        const memory = handler.initMemory(type as any)
        handler.init(memory as any)


        const targetId = handler.getTargetId()

        if(!targetId) {
            return null
        }

        this.memory.handlers.push({
            type: handler.constructor.name,
            targetId: targetId,
            data: memory
        })

        this.reservationHandlers.push(handler)
        this.handlersMap[targetId] = handler

        return handler
    }

    private createHandler<K extends ReserveClasses>(type: K): ReservableHandler {

        if(type instanceof StructureContainer) {
            return new ContainerReservation(this)
        }

        if(type instanceof StructureStorage) {
            return new ContainerReservation(this)
        }

        if(type instanceof Tombstone) {
            return new ContainerReservation(this)
        }

        if(type instanceof StructureSpawn) {
            return new ContainerReservation(this)
        }

        if(type instanceof StructureExtension) {
            return new ContainerReservation(this)
        }

        if(type instanceof StructureTower) {
            return new ContainerReservation(this)
        }

        if(type instanceof Ruin) {
            return new ContainerReservation(this)
        }

        if(type instanceof Resource) {
            return new ResourceReservation(this)
        }

        if(type instanceof ExtensionCluster) {
            return new ExtensionClusterReservation(this)
        }

        if(type instanceof StructureController) {
            return new ControllerReservation(this)
        }

        throw Error("Unknown reserve type " + type.constructor.name)
    }

    createReservation(task: GenericTask) {
        const reservationId = counter.generate()
        task.registerReservation(reservationId)
        // console.log(`<span style="color: red">Creating reservation ${reservationId} for task ${task}</span>`)
        return reservationId
    }

    freeReservations(reservations: string[]) {
        // console.log(`<span style="color: red">Removing reservations ${reservations}</span>`)

        for(const handlerData of this.memory.handlers) {
            for(const reservationId of reservations) {
                const reservationIndex = handlerData.data.chunks.findIndex(chunk => chunk.reservationId === reservationId)
                if(reservationIndex >= 0) {
                    // console.log(`<span style="color: orange">Removing reservations ${reservationId} from ${handlerData.type}:${handlerData.targetId} ${JSON.stringify(handlerData.data.chunks)}</span>`)
                    handlerData.data.chunks.splice(reservationIndex, 1)
                }
            }
        }
    }

    doVisualize() {
        if(Memory.config?.visualizeReservations) {
            this.visualizeReservations()
        }
    }

    private visualizeReservations() {
        let room: Room
        if(Game.rooms.sim) {
            room = Game.rooms.sim
        } else {
            room = Object.values(Game.rooms)[0]
        }

        const lines: string[] = []

        for(const handlerData of this.memory.handlers) {
            const handler = Object.values(this.handlersMap).find(h => h.getTargetId() === handlerData.targetId)

            if(handler) {
                lines.push(`${handlerData.type}:${handler.getTargetId()} = ${handler.getReservedAmount()}`)
            }
        }

        const topOffset = 0
        lines.forEach((line, index) => {
            room.visual.text(line, 49, topOffset + index, {
                align: "right",
                stroke: "black",
                color: "white"
            })
        })
    }

    toString() {
        return "[ReservationManager]"
    }
}

