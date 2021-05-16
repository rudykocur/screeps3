import { GenericTask, TaskManager } from "TaskManager";
import { AbstractTask, RunResult, RunResultType } from "./AbstractTask";
import { counter } from "GlobalCounter";
import { TaskInitArgs, TaskMemory, TaskType } from "types";

export abstract class PersistentTask<M extends TaskMemory, IA extends TaskInitArgs> implements AbstractTask {

    protected taskId: string;
    protected memory: M;
    protected childTasks: GenericTask[] = []
    public finised: boolean = false

    constructor(protected taskManager: TaskManager, taskId: string | undefined) {
        if(taskId === undefined) {
            this.taskId = this.constructor.name + '-' + counter.generate();
        }
        else {
            this.taskId = taskId;
        }
    }

    registerChildTask(task: GenericTask) {
        this.childTasks.push(task)
    }

    removeChildTask(taskId: string) {
        this.childTasks = this.childTasks.filter(task => task.getTaskId() === taskId)
    }

    findTask<T extends GenericTask>(
        clazz: TaskType<T>
    ): T | null {
        const tasks = this.findTasks(clazz)

        if(tasks.length > 0) {
            return tasks[0]
        }

        return null
    }

    findTasks<T extends GenericTask>(
        clazz: TaskType<T>
    ): T[] {
        const x = this.childTasks.filter(task => clazz.name === task.constructor.name);
        return (x as T[])
    }

    getChildTasks() {
        return this.childTasks
    }

    getTaskId() {
        return this.taskId;
    }

    create(args: IA) {
        let memory = this.taskManager.getMemory<M>(this.taskId)
        if(memory === null) {
            memory = this.initMemory(args)
            this.taskManager.initMemory(this.taskId, this, memory);
        }

        this.memory = memory
    }

    preInit() {
        let memory = this.taskManager.getMemory<M>(this.taskId)
        if(memory === null) {
            console.log("OMG FAILED TO LOAD FROM MEMORY", this.taskId);
            return
        }
        else {
            this.memory = memory;
        }

        this.doPreInit()
    }

    init(): void {
        this.doInit();
    }

    lateInit() {
        this.doLateInit()
    }

    run(): RunResultType {
        if(!this.memory) {
            console.log("NO MEMORY !! Not running", this);
            return RunResult.DONE;
        }

        const result = this.doRun();

        if(result === RunResult.DONE) {
            this.finised = true
        }

        return result
    }

    visualize() {
        this.doVisualize()
    }

    scheduleBlockingTask<M extends TaskMemory, IA extends TaskInitArgs, T extends PersistentTask<M, IA>>(
        taskFactory: TaskType<T>,
        args: IA,
    ): T {
        return this.taskManager.scheduleTask(taskFactory, args, {
            blocking: true,
            parent: this,
        })
    }

    scheduleChildTask<M extends TaskMemory, IA extends TaskInitArgs, T extends PersistentTask<M, IA>>(
        parent: GenericTask,
        taskFactory: TaskType<T>,
        args: IA,
    ): T {
        return this.taskManager.scheduleTask(taskFactory, args, {
            blocking: true,
            parent: parent,
        })
    }

    scheduleBackgroundTask<M extends TaskMemory, IA extends TaskInitArgs, T extends PersistentTask<M, IA>>(
        taskFactory: TaskType<T>,
        args: IA,
    ): T {
        return this.taskManager.scheduleTask(taskFactory, args, {
            blocking: false,
            parent: this,
        })
    }

    sleep(ticks: number) {
        this.taskManager.delayTask(this, ticks)
    }

    wakeUp() {
        this.taskManager.wakeUp(this)
    }

    registerReservation(reservationId: string) {
        this.taskManager.registerReservation(this, reservationId)
    }

    abstract initMemory(args: IA): M
    doPreInit() {}
    doLateInit() {}
    abstract doInit(): void
    abstract doRun(): RunResultType
    doVisualize() {}
}


// add a registry of the type you expect
export namespace PersistentTask {
    type Constructor<T> = {
        new(...args: any[]): T;
        readonly prototype: T;
    }
    const implementations: Constructor<GenericTask>[] = [];
    export function GetImplementations(): Constructor<GenericTask>[] {
        return implementations;
    }
    export function register<T extends Constructor<GenericTask>>(ctor: T) {
        implementations.push(ctor);
        return ctor;
    }
}
