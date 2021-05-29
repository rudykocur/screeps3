
interface BuildParams {
    pattern: BodyPartConstant[],
    budget: number,
    prefix?: BodyPartConstant[],
    suffix?: BodyPartConstant[]
}

export function build(params: BuildParams): BodyPartConstant[] {

    const prefix = params.prefix || [];
    const suffix = params.suffix || [];

    let baseCost = _.sum(prefix.concat(suffix), part => BODYPART_COST[part]);
    let patternCost = _.sum(params.pattern, part => BODYPART_COST[part]);

    if(baseCost + patternCost > params.budget) {
        return prefix.concat(suffix);
    }

    let spentBudget = baseCost;

    let result: BodyPartConstant[] = [];
    let len = prefix.length + suffix.length + params.pattern.length;

    do {
        result = result.concat(params.pattern);
        spentBudget += patternCost;
    } while(spentBudget + patternCost <= params.budget && result.length + len < MAX_CREEP_SIZE);

    return prefix.concat(result, suffix);
}
