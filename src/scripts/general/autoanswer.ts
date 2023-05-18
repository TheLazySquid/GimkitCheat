import { HudObject } from "../../interfaces";

const hudAddition: HudObject = {
    menus: [
        {
            name: "General Cheats",
            elements: [
                {
                    type: "toggle",
                    options: {
                        textEnabled: "Stop auto answering",
                        textDisabled: "Auto answer",
                        default: false,
                        runFunction: "setAutoAnswer",
                        keybind: true,
                        keybindId: "autoAnswer"
                    }
                }
            ]
        }
    ]
}

class AutoanswerClass {
    name: string = "Autoanswer";
    hudAddition: HudObject = hudAddition;
    autoAnswering: boolean = false;
    funcs: Map<string, Function> = new Map([
        ["setAutoAnswer", (enabled: boolean) => {
            this.autoAnswering = enabled;
        }]
    ]);
    currentQuestionId: string = "";
    answerDeviceId: string = "";
    questions: any[] = [];

    // blueboat specific
    questionIdList: string[] = [];
    currentQuestionIndex: number = 0;

    init(cheat: any) {
        cheat.socketHandler.addEventListener("recieveMessage", (e: CustomEvent) => {
            if(cheat.socketHandler.transportType == "colyseus") return
            
            // get the questions and question list
            if(e.detail?.key != "STATE_UPDATE") return

            switch(e.detail.data.type) {
                case "GAME_QUESTIONS":
                    this.questions = e.detail.data.value;
                    break;

                case "PLAYER_QUESTION_LIST":
                    this.questionIdList = e.detail.data.value.questionList;
                    this.currentQuestionIndex = e.detail.data.value.questionIndex;
                    break;

                case "PLAYER_QUESTION_LIST_INDEX":
                    this.currentQuestionIndex = e.detail.data.value;
                    break;
            }
        })

        cheat.socketHandler.addEventListener("recieveChanges", (e: CustomEvent) => {
            let changes: any[] = e.detail;

            for(let change of changes) {
                // try to get the device ID of the answer device
                for(let [key, value] of Object.entries(change.data)) {
                    if(key != "GLOBAL_questions") continue;

                    this.questions = JSON.parse(value as string);
                    this.answerDeviceId = change.id;
                }

                // check whether it includes the new question ID
                for(let [key, value] of Object.entries(change.data)) {
                    if(key.includes("currentQuestionId") && key.includes((unsafeWindow as any).stores?.phaser?.mainCharacter?.id)) {
                        this.currentQuestionId = value as string;
                    }
                }
            }
        })

        setInterval(() => {
            if(!this.autoAnswering) return;

            if(cheat.socketHandler.transportType == "colyseus") {
                if(this.currentQuestionId == "") return
                
                let correctQuestion = this.questions?.find(q => q._id == this.currentQuestionId)
                if(!correctQuestion) return;

                let correctAnswerId = correctQuestion.answers.find((a: any) => a.correct)._id

                let packet = {
                    key: 'answered',
                    deviceId: this.answerDeviceId,
                    data: {
                        answer: correctAnswerId
                    }
                }

                cheat.socketHandler.sendData("MESSAGE_FOR_DEVICE", packet)
            } else {
                let questionId = this.questionIdList[this.currentQuestionIndex]
                let answerId = this.questions.find(q => q._id == questionId).answers.find((a: any) => a.correct)._id

                cheat.socketHandler.sendData("QUESTION_ANSWERED", {
                    answer: answerId,
                    questionId: questionId
                })
            }
        }, 1000)
    }
}

export function Autoanswer() {
    return new AutoanswerClass();
}