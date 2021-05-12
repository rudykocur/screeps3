import { GenericTask } from "TaskManager";
import { RunResultType } from "tasks/AbstractTask";
import { StructureWithGeneralStorage } from "types";
import { PersistentTask } from "../PersistentTask";
import { counter } from "GlobalCounter";
import { ContainerReservation } from "./ContainerReservation";
import { ResourceReservation } from "./ResourceReservation";
import { ReservationManagerMemory, ReservationManagerArgs, ReservableHandler, IReservationManager } from "./common";

type ReserveClasses = StructureSpawn | StructureWithGeneralStorage | Resource

@PersistentTask.register
export class ReservationManager extends PersistentTask<ReservationManagerMemory, ReservationManagerArgs> implements IReservationManager {

    private reservationHandlers: ReservableHandler[] = []
    private handlersMap: Record<string, ReservableHandler> = {}

    initMemory(args: ReservationManagerArgs): ReservationManagerMemory {
        return {
            handlers: [],
        }
    }

    doInit(): void {
        const implementations = IReservationManager.getReservationHandlers()
        this.memory.handlers.forEach(handlerData => {
            const impl = implementations.find(impl => impl.name === handlerData.type)

            if(impl) {
                const handler = new impl(this)
                handler.init(handlerData.data)

                const targetId = handler.getTargetId()

                if(!targetId) {
                    console.log('[ReservationManager] WARNING! No target for', handlerData.type, '::', handlerData.targetId)
                    this.memory.handlers = this.memory.handlers.filter(handler => handler.targetId !== handlerData.targetId)
                    return
                }

                this.reservationHandlers.push(handler)
                this.handlersMap[targetId] = handler
            }
            else {
                console.log('[ReservationManager] WARNING! No implementation for', handlerData.type)
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

        if(type instanceof Resource) {
            return new ResourceReservation(this)
        }

        throw Error("Unknown reserve type " + type.constructor.name)
    }

    createReservation(task: GenericTask) {
        const reservationId = counter.generate()
        task.registerReservation(reservationId)
        console.log(`<span style="color: red">Creating reservation ${reservationId} for task ${task}</span>`)
        return reservationId
    }

    freeReservations(reservations: string[]) {
        console.log(`<span style="color: red">Removing reservations ${reservations}</span>`)

        for(const handlerData of this.memory.handlers) {
            handlerData.data.chunks = handlerData.data.chunks.filter(chunk => reservations.indexOf(chunk.reservationId) < 0)
        }
    }

    toString() {
        return "[ReservationManager]"
    }
}

