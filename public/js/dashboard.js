const connectButton = $('#connectButton');
const answerButton = $('#answerButton');
const hangupButton = $('#hangupButton');
const userIdInput = $('#user_id');

const callStatus = $('#callStatus');
const noUsers = $('#noUsers');
const usersList = $('#usersList');

$(document).ready(function() {
  connectButton.on('click', function(event) {
    event.preventDefault();
    connectButton.prop('disabled', true);

    const webSocket = new WebSocket(`${window.config.websocketProtocol}://${window.config.host}/client-socket`);
    webSocket.onmessage = function (msg) {
      const data = JSON.parse(msg.data);
      if (data.event === "transcription") {
        if (data.type === 'interim') {
          $(`#${data.transcriber}InterimContainer .${data.from}`).text(data.text);
        } else if (data.type === 'final') {
          $(`#${data.transcriber}ChatContainer`).prepend(`<li><i>${data.from} said:</i> ${data.text}</li>`);
        }
      } else {
        console.log(`Got message: ${msg.data}`);
      }
    };

    userId = userIdInput.val();
    $.post("/token/generate", { user_id: userId })
      .then(function(data) {
        // Setup Twilio.Device
        const device = new Twilio.Device(data.token, {
          // Set Opus as our preferred codec. Opus generally performs better, requiring less bandwidth and
          // providing better audio quality in restrained network conditions. Opus will be default in 2.0.
          codecPreferences: ["opus", "pcmu"],
          // Use fake DTMF tones client-side. Real tones are still sent to the other end of the call,
          // but the client-side DTMF tones are fake. This prevents the local mic capturing the DTMF tone
          // a second time and sending the tone twice. This will be default in 2.0.
          fakeLocalDTMF: true,
          // Use `enableRingingState` to enable the device to emit the `ringing`
          // state. The TwiML backend also needs to have the attribute
          // `answerOnBridge` also set to true in the `Dial` verb. This option
          // changes the behavior of the SDK to consider a call `ringing` starting
          // from the connection to the TwiML backend to when the recipient of
          // the `Dial` verb answers.
          enableRingingState: true
        });

        hangupButton.on('click', function(event) {
          event.preventDefault();

          device.disconnectAll();
        });

        device.on("ready", function(_device) {
          console.log("Twilio.Device Ready!");
          updateCallStatus("Ready");

          data.availableUsers.forEach(function(user) {
            if (user === userId) return

            noUsers.addClass('d-none');
            let item = $(`<li>${user}<button class="btn btn-success ml-2">Call</button></li>`).appendTo(usersList);
            item.find('button').on('click', function(event) {
              event.preventDefault();

              device.connect({ user: user });
            });
          });
        });

        device.on("error", function(error) {
          console.log("Twilio.Device Error: " + error.message);
          updateCallStatus("ERROR: " + error.message);
        });

        device.on("connect", function(conn) {
          console.log("Successfully established call!");
          hangupButton.prop("disabled", false);
          answerButton.prop("disabled", true);
          usersList.find('button').prop("disabled", true);
          clearChatLogs();

          calledUser = conn.message.user;

          updateCallStatus(`In call with ${calledUser}`);
        });

        device.on("disconnect", function(_conn) {
          // Disable the hangup button and enable the call buttons
          hangupButton.prop("disabled", true);
          usersList.find('button').prop("disabled", false);

          updateCallStatus("Ready");
        });

        device.on("incoming", function(conn) {
          incomingUser = conn.parameters.From.replace(/^client:/, '')
          updateCallStatus(`Incoming call from ${incomingUser}`);

          // Set a callback to be executed when the connection is accepted
          conn.accept(function() {
            updateCallStatus(`In call with ${incomingUser}`);
          });

          // Set a callback on the answer button and enable it
          answerButton.on('click', function(event) {
            event.preventDefault();
            clearChatLogs();

            conn.accept();
          });
          answerButton.prop("disabled", false);
        });
      })
      .catch(function(err) {
        console.log(err);
        console.log("Could not get a token from server!");
      });
  });
});

/* Helper function to update the call status bar */
function updateCallStatus(status) {
  callStatus.text(status);
}

function clearChatLogs() {
  $('#interimContainerRow .inbound, #interimContainerRow .outbound').text('');
  $('#chatContainerRow li').remove()
}
