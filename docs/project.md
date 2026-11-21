
**Project Description:** Our core web app at Cypris is built in Angular and retrieves scientific data via our APIs. We’d like you to build a mini-Cypris in the form of an Angular app that retrieves data from a (free) third-party API, presents that data in a clean UI of your design, and allows a user to search through it efficiently.

**Steps:**

1. Create a new Angular project using version 20 or higher.

2. Review the API documentation for <https://core.ac.uk/> which is an open API for free-to-use research paper data. Learn how to do a simple GET request to make queries. For example:

   <https://api.core.ac.uk/v3/search/works?q=(drone)>

3. Build a UI that presents these paper objects with a clean and intuitive design of your making.

4. Add a field for the user that lets them change how many papers are returned from the API.

5. Add a search bar that allows users to search through the documents collected via a boolean keyword search

   1. Example: `(drone AND (package OR delivery))`
   2. CORE Resource: *How to Search:* <https://api.core.ac.uk/docs/v3#section/How-to-search>

6. Add a chart to the design. The chart should aggregate data from all papers that match a given query. You can choose to find the chart information from the data stored client-side or from the API in aggregate. You can design the chart in whichever way you feel presents the following data as effectively as possible. If no query has yet been entered, the chart can be blank.

7. Push your project to a public Github repo and send the link to chris@cypris.ai. The repo should include:

   1. Build/run instructions in the README.
   2. Multiple commits building up the project, where the project is “working” at each stage.

8. Finally, don’t be afraid to include capabilities (user facing or otherwise) that aren’t described above. It won’t count against you if you don’t add anything, but we’re curious to see your creativity! Please be sure to enumerate anything you add when submitting your project.

Thanks! We look forward to seeing your code!
