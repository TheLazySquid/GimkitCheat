<script lang="ts">
    import ToggleButton from "../hud/components/ToggleButton.svelte";
    import socketManager from "../network/socketManager";
    import { IColyseusMessage, IDeviceChange } from "../types";
    import { playerId } from "../stores";

    let { transportType } = socketManager;

    let questions = []
    let answerDeviceId: string | null = null;
    let currentQuestionId: string | null = null;

    let questionIdList: string[] = [];
    let currentQuestionIndex: number = -1;

    $: enabled = $transportType == "colyseus" ?
        questions.length > 0 && currentQuestionId != null && answerDeviceId != null :
        questionIdList.length > 0 && questions.length > 0 && currentQuestionIndex != -1;

    function answerQuestion() {
        if($transportType === 'colyseus') {
            if(currentQuestionId == null) return;

            // find the correct question
            let question = questions.find(q => q._id == currentQuestionId);
            if(!question) return;

            let packet: any = {
                key: 'answered',
                deviceId: answerDeviceId,
                data: {}
            }

            // create a packet to send to the server
            if(question.type == 'text') {
                packet.data.answer = question.answers[0].text;
            } else {
                let correctAnswerId = question.answers.find((a: any) => a.correct)._id
                packet.data.answer = correctAnswerId
            }

            socketManager.sendMessage("MESSAGE_FOR_DEVICE", packet);
        } else {
            let questionId = questionIdList[currentQuestionIndex]
        
            let question = questions.find(q => q._id == questionId)
            if(!question) return;
            
            let answer: string;
            if(question.type == 'mc') {
                answer = question.answers.find((a: any) => a.correct)._id
            } else {
                answer = question.answers[0].text
            }

            socketManager.sendMessage("QUESTION_ANSWERED", {
                answer,
                questionId: questionId
            })
        }
    }

    let answerInterval: number; // should probably be a number but I don't care
    function toggleAutoAnswer(event: CustomEvent<boolean>) {
        if(event.detail) {
            answerInterval = setInterval(answerQuestion, 1000) as any;
        } else {
            clearInterval(answerInterval);
        }
    }

    
    socketManager.addEventListener("deviceChanges", (event: CustomEvent<IDeviceChange[]>) => {
        for(let { id, data } of event.detail) {
            for(let key in data) {
                if(key == "GLOBAL_questions") {
                    questions = JSON.parse(data[key]);
                    console.log("Got questions", questions);
                    
                    answerDeviceId = id;
                }
            
                if(key == `PLAYER_${$playerId}_currentQuestionId`) {
                    currentQuestionId = data[key];
                }
            }
        }
    })
    
    socketManager.addEventListener("blueboatMessage", (event: CustomEvent<any>) => {
        if(event.detail?.key != "STATE_UPDATE") return;
        
        switch(event.detail.data.type) {
            case "GAME_QUESTIONS":
                questions = event.detail.data.value;
                break;
    
            case "PLAYER_QUESTION_LIST":
                questionIdList = event.detail.data.value.questionList;
                currentQuestionIndex = event.detail.data.value.questionIndex;
                break;
    
            case "PLAYER_QUESTION_LIST_INDEX":
                currentQuestionIndex = event.detail.data.value;
                break;
        }
    })
</script>

<ToggleButton on:click={toggleAutoAnswer} disabled={!enabled} disabledMsg="Questions haven't loaded yet"
onText="Stop auto answering" offText="Start auto answering" enabled={false} hotkeyId="autoAnswer" />