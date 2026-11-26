---
layout: "post"
title: "Automating Disney"
date: 2021-04-29 22:05:43 -0400
description: "Setting up a pipedream.com workflow"
summary: "How a small Pipedream workflow helped my family find an opening at Disney’s Magic Kingdom."
subtitle: "Setting up a pipedream.com workflow"
tags:
  - automation
  - javascript
  - devops
cover: "/assets/images/castle.jpg"
---
## The Problem

My family planned an April trip to Disney for my sister-in-law’s birthday. We had the house, the flights, and the tickets. Then we hit a snag. We’d bought our tickets at different times, and some of us couldn’t [reserve a spot at Magic Kingdom](https://disneyworld.disney.go.com/experience-updates/park-reservations/).

I wanted to know as soon as a spot opened up so we could all go together.

## The Calendar
![Disney’s park reservation calendar showing availability by date]({{ '/assets/blog-images/2021-04-29-automating-disney/01-calendar.png' | relative_url }})

Checking by hand meant picking a date, reading the list of available parks, and doing it all again. I wanted to spend my time planning the trip, so I looked for the data behind the calendar.

## Finding The Data
![The calendar response in the browser’s network inspector]({{ '/assets/blog-images/2021-04-29-automating-disney/02-preview.png' | relative_url }})

I opened the browser’s developer tools, reloaded the page, and checked the XHR requests. One request was named `calendar`.

## The API

Opening the request in a new window showed the JSON response. The URL also showed how the calendar narrowed the search.

>https://disneyworld.disney.go.com/availability-calendar/api/calendar?segment=tickets&startDate=2021-04-05&endDate=2021-04-30

Three query parameters mattered for our trip.

- `startDate`
- `endDate`
- `segment`

## Decoding Response

Now that we discovered the format of the request next we need to understand the response.

```json
[
  {
    "date": "2021-04-17",
    "availability": "none",
    "parks": []
  },
  {
    "date": "2021-04-18",
    "availability": "partial",
    "parks": [
      "80007838"
    ]
  },
  {
    "date": "2021-04-19",
    "availability": "partial",
    "parks": [
      "80007838"
    ]
  },
  {
    "date": "2021-04-20",
    "availability": "partial",
    "parks": [
      "80007823",
      "80007838"
    ]
  }
]
```
Each item had three fields. The park IDs took a little detective work.

- `date`
- `availability` 
- `parks` list of parks that are available
  - `Epcot 80007838`
  - `Animal Kingdom 80007823`
  - `Magic Kingdom 80007944`
  - `Hollywood Studios 80007998`

We matched each ID to a park by picking dates on the calendar and comparing the names on screen with the numbers in the response.

## NodeJs

I used Node.js and [Axios](https://github.com/axios/axios) to check the date we wanted. The script needed to fetch availability, match park IDs to names, and flag an opening at Magic Kingdom.

```javascript
const axios = require("axios");

let url =
    "https://disneyworld.disney.go.com/availability-calendar/api/calendar?segment=tickets&startDate=2021-04-17&endDate=2021-04-17";

(async () => {
    try {
        const response = await axios.get(url);

        var epcot = "80007838";
        var animalKingdom = "80007823";
        var magicKingdom = "80007944";
        var hollywood = "80007998";

        var message = "";
        var alert = false;

        response.data.forEach((date) => {
            message += `Date: ${date.date} | Parks:`;
            var parkNames = [];
            date.parks.forEach((park) => {
                if (park === epcot) {
                    parkNames.push("Epcot");
                }
                if (park === animalKingdom) {
                    parkNames.push("Animal Kingdom");
                }
                if (park === magicKingdom) {
                    alert = true;
                    parkNames.push("Magic Kingdom");
                }
                if (park === hollywood) {
                    parkNames.push("Hollywood");
                }
            });
            message += `${parkNames.join()} \n`;
        });
        if (alert) {
            //send alert
        }
    } catch (error) {
        console.log(error.response.body);
    }
})();
```

The script listed every park with space on April 17, 2021. Only an opening at Magic Kingdom triggered our alert.

## Automation

The next question was where to run the check. A cron job would work, but a hosted workflow could keep checking even when my computer was off.

![The scheduled calendar-checking workflow in Pipedream]({{ '/assets/blog-images/2021-04-29-automating-disney/03-pipedream.png' | relative_url }})

I decided to go with [pipedream](https://pipedream.com) as it ticked all the boxes.

>Stop writing boilerplate code, struggling with authentication and managing infrastructure. Start connecting APIs with code-level control when you need it — and no code when you don't.

### Convert to Workflow

Pipedream supported Node.js, so I could reuse the code that checked the calendar.

### Steps

I split the workflow into three steps. One supplied the date, one checked availability, and one sent the email.

#### Dates

The first step returned the date we wanted to check.

```javascript
async (event, steps) => {
    return {
        date: "2021-04-17"
    }
}
```

#### Check API

The calendar check needed two changes to run as a workflow step.

- pass in the `date` via the `steps` object `steps.date_to_check.$return_value.date;`
- return an object so it can be used in future steps

```javascript
        return {
            alert: alert,
            message: message
        };
```

```javascript
async (event, steps) => {
    const axios = require("axios");

    let date = steps.date_to_check.$return_value.date;
    let url =
        `https://disneyworld.disney.go.com/availability-calendar/api/calendar?segment=tickets&startDate=${date}&endDate=${date}`;

    try {
        const response = await axios.get(url);

        var epcot = "80007838";
        var animalKingdom = "80007823";
        var magicKingdom = "80007944";
        var hollywood = "80007998";

        var message = "";
        var alert = false;

        response.data.forEach((date) => {
            message += `Date: ${date.date} | Parks:`;
            var parkNames = [];
            date.parks.forEach((park) => {
                if (park === epcot) {
                    parkNames.push("Epcot");
                }
                if (park === animalKingdom) {
                    parkNames.push("Animal Kingdom");
                }
                if (park === magicKingdom) {
                    alert = true;
                    parkNames.push("Magic Kingdom");
                }
                if (park === hollywood) {
                    parkNames.push("Hollywood");
                }
            });
            message += `${parkNames.join()} \n`;
        });
        return {
            alert: alert,
            message: message
        };
    } catch (error) {
        console.log(error.response.body);
    }
}
```

#### Email

I used [SendGrid](https://sendgrid.com) for email. [Pipedream’s SendGrid connector](https://pipedream.com/apps/sendgrid) gave me a template to start from.

```javascript
async (event, steps, params, auths) => {
    const axios = require('axios')
    if (steps.check_disney_calendar.$return_value.alert) {
        return await require("@pipedreamhq/platform").axios(this, {
            url: `https://api.sendgrid.com/v3/mail/send`,
            headers: {
                Authorization: `Bearer ${auths.sendgrid.api_key}`,
            },
            method: 'POST',
            data: {
                "personalizations": [{
                    "to": [{
                        "email": params.to_email,
                        "name": params.to_name
                    }],
                    "subject": params.subject
                }],
                "from": {
                    "email": params.from_email,
                    "name": params.from_name
                },
                "reply_to": {
                    "email": params.reply_to_email,
                    "name": params.reply_to_name
                },
                "content": [{
                    "type": params.type,
                    "value": params.value
                }]
            }
        })
    }
}
```
_we modified the built in template slightly to only send the email if `steps.check_disney_calendar.$return_value.alert` is actually true_

Now that we have all of these in place it is time to try it out by finding a date that has availability and use that in the `date` step.

### Testing It Out
![An email alert listing available parks for the selected date]({{ '/assets/blog-images/2021-04-29-automating-disney/04-email.png' | relative_url }})

We set the workflow to trigger every 10 minutes and as soon as we hit the right condition we got the above email.

## Time To Wait...Did it work?

### Yes

It worked. As soon as the email arrived, I contacted every family member by hand. Maybe next time I’ll let Twilio make the calls, too.
