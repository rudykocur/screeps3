interface IEvent {
    [key: string]: any
}

type Observer<TEvent extends IEvent> = (payload: TEvent) => void;

type ClassHandlerOrObserver<TEvent extends IEvent> = Observer<TEvent> | IEventHandler<TEvent>;

interface IEventHandler<TEvent extends IEvent> {
    handleEvent(event: TEvent): void;
}

interface BusDefinition {
    [key: string]: IEvent;
}

export interface IEventBus<Events extends BusDefinition> {
    /**
     * Subscribes a given handler or observer as a listener for events on the provided Channel.
     * @param channel           The Bus channel upon which to consume events.
     * @param handlerOrObserver The handler/observer callback to consume events.
     */
    subscribe<K extends keyof Events>(channel: K, handlerOrObserver: ClassHandlerOrObserver<Events[K]>): ClassHandlerOrObserver<Events[K]>;

    /**
     * Removes a given handler/observer from a given Channel.
     * @param channel           The Bus channel from which to remove the Observer.
     * @param handlerOrObserver The handler/observer callback to remove from the Channel.
     */
    unsubscribe<K extends keyof Events>(channel: K, handlerOrObserver: ClassHandlerOrObserver<Events[K]>): void;

     /**
     * Dispatches an event with a given payload upon the provided Channel.
     * @param channel The Bus channel upon which to dispatch an event.
     * @param payload The payload to emit.
     */
    dispatch<K extends keyof Events>(channel: K, payload: Events[K]): void;
}

/**
 * Creates an Event Bus.
 */
export function createEventBus<Events extends BusDefinition>() {
    const EventBus = (): IEventBus<Events> => {
        const listenerMap: Map<keyof Events, (Observer<IEvent> | IEventHandler<IEvent>)[]> = new Map();

        return {
            subscribe: <K extends keyof Events>(channel: K, handlerOrObserver: ClassHandlerOrObserver<Events[K]>): ClassHandlerOrObserver<Events[K]> => {
                if (!listenerMap.has(channel)) {
                    listenerMap.set(channel, [handlerOrObserver] as ClassHandlerOrObserver<IEvent>[]);
                } else {
                    listenerMap.get(channel)!.push(handlerOrObserver as ClassHandlerOrObserver<IEvent>);
                }

                return handlerOrObserver;
            },

            unsubscribe: <K extends keyof Events>(channel: K, targetHandlerOrObserver: ClassHandlerOrObserver<Events[K]>): void => {
                if (listenerMap.has(channel)) {
                    const handlers = listenerMap.get(channel)!;
                    const handlersWithoutTarget = handlers.filter(handlerOrObserver => handlerOrObserver !== targetHandlerOrObserver);
                    listenerMap.set(channel, handlersWithoutTarget);
                }
            },

            dispatch<K extends keyof Events>(channel: K, payload: Events[K]): void {
                if (listenerMap.has(channel)) {
                    const handlers = listenerMap.get(channel)!;
                    handlers.forEach(handler => {
                        if (typeof handler === 'function') {
                            handler(payload)
                        } else {
                            handler.handleEvent(payload);
                        }
                    });
                }
            }
        }
    }

    return EventBus();
}

interface MasterBusDefinition {
    [key: string]: IEventBus<any>;
}

export interface IEventBusMaster<T extends MasterBusDefinition> {
    getBus<K extends keyof T>(busName: K): T[K];

    subscribe<
        BusName extends keyof T,
        BusEvents extends T[BusName] extends IEventBus<infer A> ? A : never,
        EventName extends keyof BusEvents
    >(
        busName: BusName,
        channel: EventName,
        handlerOrObserver: ClassHandlerOrObserver<BusEvents[EventName]>
    ): ClassHandlerOrObserver<BusEvents[EventName]>;

    unsubscribe<
        BusName extends keyof T,
        BusEvents extends T[BusName] extends IEventBus<infer A> ? A : never,
        EventName extends keyof BusEvents,
    >(
        busName: BusName,
        channel: EventName,
        handlerOrObserver: ClassHandlerOrObserver<BusEvents[EventName]>
    ): void;

    dispatch<
        BusName extends keyof T,
        BusEvents extends T[BusName] extends IEventBus<infer A> ? A : never,
        EventName extends keyof BusEvents
    >(
        busName: BusName,
        channel: EventName,
        payload: BusEvents[EventName]
    ): void;
}

export class EventBusMaster<T extends MasterBusDefinition> implements IEventBusMaster<T> {
    public constructor (private busMap: T) {}

    public getBus<K extends keyof T>(busName: K): T[K] {
        return this.busMap[busName];
    }

    public subscribe<
        BusName extends keyof T,
        BusEvents extends T[BusName] extends IEventBus<infer A> ? A : never,
        EventName extends keyof BusEvents
    >(
        busName: BusName,
        channel: EventName,
        handler: ClassHandlerOrObserver<BusEvents[EventName]>
    ): ClassHandlerOrObserver<BusEvents[EventName]> {
        this.busMap[busName].subscribe(channel, handler);
        return handler;
    }

    public unsubscribe<
        BusName extends keyof T,
        BusEvents extends T[BusName] extends IEventBus<infer A> ? A : never,
        EventName extends keyof BusEvents
    >(
        busName: BusName,
        channel: EventName,
        handler: ClassHandlerOrObserver<BusEvents[EventName]>
    ): void {
        this.busMap[busName].unsubscribe(channel, handler);
    }

    public dispatch<
        BusName extends keyof T,
        BusEvents extends T[BusName] extends IEventBus<infer A> ? A : never,
        EventName extends keyof BusEvents
    >(
        busName: BusName,
        channel: EventName,
        payload: BusEvents[EventName]
    ): void {
        this.busMap[busName].dispatch(channel as string, payload);
    }
}
