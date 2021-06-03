import { GenericTask } from "TaskManager";

export interface ReservationChunk {
    reservationId: string
}

export interface ReservationMemory {
    chunks: ReservationChunk[]
    volatile?: boolean
}

export interface ReservableHandler {
    initMemory(target: any): ReservationMemory
    init(memory: any): void
    getTargetId(): string | undefined
    reserve(task: GenericTask, amount: number): void
    getReservedAmount(): number
}

export interface ReservationManagerMemory {
    handlers: ReservationHandlerMemory[]
}

export interface ReservationManagerArgs {}

export interface ReservationHandlerMemory {
    type: string
    targetId: string
    data: ReservationMemory
}

export interface IReservationManager {
    createReservation(task: GenericTask): string
}

export namespace IReservationManager {
    type Constructor<T> = {
        new(manager: IReservationManager): T;
        readonly prototype: T;
    }
    const implementations: Constructor<ReservableHandler>[] = [];
    export function getReservationHandlers(): Constructor<ReservableHandler>[] {
        return implementations;
    }
    export function registerReservationHandler<T extends Constructor<ReservableHandler>>(ctor: T) {
        implementations.push(ctor);
        return ctor;
    }
}
