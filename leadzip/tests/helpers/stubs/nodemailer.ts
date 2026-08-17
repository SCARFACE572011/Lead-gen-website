/**
 * Unit-test stand-in for nodemailer. The Stripe webhook imports it for the
 * trial-ending reminder, which none of the money-handling tests exercise.
 */
const nodemailerStub = {
  createTransport() {
    return {
      async sendMail() {
        throw new Error('sendMail is not available in unit tests.')
      },
    }
  },
}

export default nodemailerStub
