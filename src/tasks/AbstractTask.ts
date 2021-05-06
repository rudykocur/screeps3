
export enum RunResult {
    DONE
}

export type RunResultType = RunResult | void;

export interface AbstractTask {
    init(): void;
    run(): RunResultType;
};

// // add a registry of the type you expect
// export namespace AbstractTask {
//     type Constructor<T> = {
//         new(...args: any[]): T;
//         readonly prototype: T;
//     }
//     const implementations: Constructor<AbstractTask>[] = [];
//     export function GetImplementations(): Constructor<AbstractTask>[] {
//         return implementations;
//     }
//     export function register<T extends Constructor<AbstractTask>>(ctor: T) {
//         console.log("OMG REGISTERING", ctor.name);
//         implementations.push(ctor);
//         return ctor;
//     }
// }
