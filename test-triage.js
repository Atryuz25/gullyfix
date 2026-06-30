fetch("http://localhost:3000/api/triage", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    issueId: "test_issue_id",
    data: {
      location: { latitude: 17.4239, longitude: 78.4062 },
      photoURL: "https://res.cloudinary.com/dp9apqsir/image/upload/v1700000000/sample.jpg",
      description: "Pothole on the main road",
    },
  }),
})
  .then((res) => res.json())
  .then(console.log)
  .catch(console.error);
