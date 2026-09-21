class SafetyPrerequisiteSkippedError  extends Error {
    constructor(message = 'Cannot create a work order without documented safety prerequisites'){
        super(message)
        this.name ='SafetyPrerequisiteSkippedError'
    }
}

module.exports=SafetyPrerequisiteSkippedError

